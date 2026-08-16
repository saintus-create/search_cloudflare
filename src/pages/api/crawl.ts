import type { APIRoute } from 'astro';
import { requireIngestAuth } from '../../lib/api-auth';

const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_STORED_CONTENT = 100_000;
const MAX_REDIRECTS = 3;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const isPrivateHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '');
  if (
    host === 'localhost' || host.endsWith('.localhost') || host === 'local' ||
    host.endsWith('.local') || host === 'metadata.google.internal' ||
    host === 'instance-data.ec2.internal' || host === '0.0.0.0' || host === '::' ||
    host === '::1'
  ) return true;

  // IPv4 literals, including IPv4-mapped IPv6 forms.
  const mapped = host.match(/^::ffff:(\d+)\.(\d+)\.(\d+)\.(\d+)$/i);
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  const octets = (ipv4 || mapped)?.slice(1).map(Number);
  if (octets) {
    const [a, b, c, d] = octets;
    if ([a, b, c, d].some((n) => n < 0 || n > 255)) return true;
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }

  // IPv6 special-use/private ranges. URL.hostname retains the IPv6 literal without brackets.
  if (host.includes(':')) {
    const first = host.split(':')[0] || '0';
    const prefix = parseInt(first, 16);
    return Number.isFinite(prefix) && (
      prefix === 0 || prefix === 0x7f00 || // defensive handling of unusual parser forms
      (prefix >= 0xfc00 && prefix <= 0xfdff) || // fc00::/7
      (prefix >= 0xfe80 && prefix <= 0xfebf) // fe80::/10
    ) || host === '::1';
  }

  return false;
};

const validateUrl = (value: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error('Private or local network targets are not allowed');
  }

  return parsed;
};

const readLimitedText = async (response: Response) => {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('Remote response exceeds the 1 MB limit');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Remote response exceeds the 1 MB limit');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
};

const fetchPublicUrl = async (initialUrl: URL) => {
  let current = initialUrl;

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    // Re-validate every hop. Never follow a redirect to a private/local target.
    current = validateUrl(current.toString());
    const response = await fetch(current, {
      headers: {
        'User-Agent': 'CloudflareSearchBot/1.0',
        Accept: 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || attempt === MAX_REDIRECTS) {
        throw new Error('Too many redirects or invalid redirect response');
      }
      current = validateUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) throw new Error(`Remote server returned HTTP ${response.status}`);

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('Remote resource is not a supported text document');
    }

    return { response, url: current };
  }

  throw new Error('Unable to fetch URL');
};

export const POST: APIRoute = async (context) => {
  const authError = requireIngestAuth(context);
  if (authError) return authError;

  try {
    const contentLength = Number(context.request.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) return json({ error: 'Request body is too large' }, 413);

    const body = await context.request.json() as { url?: string };
    if (!body.url || typeof body.url !== 'string') return json({ error: 'URL is required' }, 400);

    const target = validateUrl(body.url.trim());
    const env = context.locals?.runtime?.env || {};
    const DB = env.DB;
    if (!DB) return json({ error: 'Database binding missing.' }, 500);

    const { response, url } = await fetchPublicUrl(target);
    const raw = await readLimitedText(response);
    const content = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, MAX_STORED_CONTENT);
    if (!content) return json({ error: 'Remote document contained no readable text' }, 422);

    const canonicalUrl = url.toString();
    const title = url.hostname;
    const metadata = JSON.stringify({ source: 'url', fetched_at: new Date().toISOString() });

    const existing = await DB.prepare('SELECT id FROM documents WHERE url = ?')
      .bind(canonicalUrl)
      .first<{ id: number }>();

    if (existing) {
      await DB.prepare('UPDATE documents SET title = ?, content = ?, metadata = ? WHERE id = ?')
        .bind(title, content, metadata, existing.id)
        .run();
      return json({ success: true, id: existing.id, title, url: canonicalUrl, updated: true });
    }

    const result = await DB.prepare('INSERT INTO documents (url, title, content, metadata) VALUES (?, ?, ?, ?)')
      .bind(canonicalUrl, title, content, metadata)
      .run();

    return json({ success: true, id: result.meta.last_row_id, title, url: canonicalUrl, updated: false }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected crawl failure';
    const clientError = /^(Invalid URL|Only HTTP|URLs with|Private or local)/.test(message);
    return json({ error: message }, clientError ? 400 : 502);
  }
};
