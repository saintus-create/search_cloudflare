const RESERVED_HOST_SUFFIXES = [
  'localhost', 'local', 'internal', 'intranet', 'lan', 'home', 'home.arpa',
  'test', 'invalid', 'example', 'onion',
];

export class RequestSecurityError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'RequestSecurityError';
  }
}

export const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });

const normalizeHostname = (hostname: string) =>
  hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

const parseIpv4 = (value: string): number | null => {
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return null;
  return (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
};

const ipv4InCidr = (ip: number, base: string, prefix: number) => {
  const baseValue = parseIpv4(base);
  if (baseValue === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) === (baseValue & mask);
};

const parseIpv6 = (input: string): bigint | null => {
  let value = normalizeHostname(input);
  if (!value.includes(':') || value.includes('%')) return null;

  const ipv4Match = value.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (ipv4Match) {
    const ipv4 = parseIpv4(ipv4Match[1]);
    if (ipv4 === null) return null;
    value = value.slice(0, -ipv4Match[1].length) +
      `${((ipv4 >>> 16) & 0xffff).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;

  const omitted = 8 - left.length - right.length;
  if ((halves.length === 1 && omitted !== 0) || (halves.length === 2 && omitted < 1)) return null;
  const groups = [...left, ...Array(Math.max(0, omitted)).fill('0'), ...right];
  if (groups.length !== 8) return null;
  return groups.reduce((result, group) => (result << 16n) | BigInt(Number.parseInt(group, 16)), 0n);
};

const ipv6InCidr = (ip: bigint, base: string, prefix: number) => {
  const baseValue = parseIpv6(base);
  if (baseValue === null) return false;
  const shift = BigInt(128 - prefix);
  return (ip >> shift) === (baseValue >> shift);
};

/** True only for ordinary globally routable IPv4/IPv6 addresses. */
export const isPublicIpAddress = (value: string): boolean => {
  const host = normalizeHostname(value);
  const ipv4 = parseIpv4(host);
  if (ipv4 !== null) {
    const blocked: Array<[string, number]> = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
      ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
      ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
      ['224.0.0.0', 4], ['240.0.0.0', 4],
    ];
    return !blocked.some(([base, prefix]) => ipv4InCidr(ipv4, base, prefix));
  }

  const ipv6 = parseIpv6(host);
  if (ipv6 === null || !ipv6InCidr(ipv6, '2000::', 3)) return false;
  const blocked: Array<[string, number]> = [
    ['2001::', 32], ['2001:db8::', 32], ['2002::', 16],
    ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
  ];
  return !blocked.some(([base, prefix]) => ipv6InCidr(ipv6, base, prefix));
};

const isIpLiteral = (hostname: string) =>
  parseIpv4(normalizeHostname(hostname)) !== null || parseIpv6(normalizeHostname(hostname)) !== null;

export const parseAllowedHosts = (value: string | undefined): ReadonlySet<string> => {
  const hosts = new Set<string>();
  for (const entry of value?.split(',') ?? []) {
    const host = normalizeHostname(entry);
    if (!host) continue;
    if ((!/^[a-z0-9.-]+$/i.test(host) && !isIpLiteral(host)) || host.includes('*')) {
      throw new RequestSecurityError('INGEST_ALLOWED_HOSTS contains an invalid hostname.', 503);
    }
    hosts.add(host);
  }
  return hosts;
};

export const validatePublicUrl = (value: string | URL, allowedHosts: ReadonlySet<string>): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestSecurityError('Invalid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RequestSecurityError('Only HTTP(S) URLs are allowed.');
  }
  if (url.username || url.password) {
    throw new RequestSecurityError('URLs with embedded credentials are not allowed.');
  }
  if ((url.protocol === 'http:' && url.port && url.port !== '80') ||
      (url.protocol === 'https:' && url.port && url.port !== '443')) {
    throw new RequestSecurityError('Only standard HTTP(S) ports are allowed.');
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname || RESERVED_HOST_SUFFIXES.some((suffix) =>
    hostname === suffix || hostname.endsWith(`.${suffix}`))) {
    throw new RequestSecurityError('Local or reserved hostnames are not allowed.');
  }
  if (allowedHosts.size === 0) {
    throw new RequestSecurityError(
      'URL ingestion is unavailable until INGEST_ALLOWED_HOSTS is configured.',
      503,
    );
  }
  if (!allowedHosts.has(hostname)) {
    throw new RequestSecurityError('The target hostname is not in the ingestion allowlist.', 403);
  }
  if (isIpLiteral(hostname) && !isPublicIpAddress(hostname)) {
    throw new RequestSecurityError('Private, local, or reserved IP targets are not allowed.');
  }

  url.hash = '';
  return url;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type DnsJsonResponse = { Status?: number; Answer?: Array<{ type?: number; data?: string }> };

export const resolvePublicAddresses = async (
  hostname: string,
  fetchImpl: FetchLike = fetch,
): Promise<string[]> => {
  const normalized = normalizeHostname(hostname);
  if (isIpLiteral(normalized)) {
    if (!isPublicIpAddress(normalized)) {
      throw new RequestSecurityError('The target IP is not publicly routable.');
    }
    return [normalized];
  }

  const resolveType = async (type: 'A' | 'AAAA') => {
    const endpoint = new URL('https://cloudflare-dns.com/dns-query');
    endpoint.searchParams.set('name', normalized);
    endpoint.searchParams.set('type', type);
    const response = await fetchImpl(endpoint, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new RequestSecurityError('Unable to validate target DNS.', 502);
    const result = await response.json() as DnsJsonResponse;
    if (result.Status !== 0 && result.Status !== 3) {
      throw new RequestSecurityError('Unable to validate target DNS.', 502);
    }
    const answerType = type === 'A' ? 1 : 28;
    return (result.Answer ?? [])
      .filter((answer) => answer.type === answerType && typeof answer.data === 'string')
      .map((answer) => answer.data as string);
  };

  const addresses = [...await resolveType('A'), ...await resolveType('AAAA')];
  if (addresses.length === 0) {
    throw new RequestSecurityError('The target hostname has no public address.');
  }
  if (addresses.some((address) => !isPublicIpAddress(address))) {
    throw new RequestSecurityError('The target resolves to a private or reserved address.');
  }
  return addresses;
};

const readLimitedResponseText = async (response: Response, maxBytes: number) => {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestSecurityError('Remote response exceeds the size limit.', 413);
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
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestSecurityError('Remote response exceeds the size limit.', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
};

export interface SafeFetchOptions {
  allowedHosts: ReadonlySet<string>;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  resolveHostname?: (hostname: string) => Promise<string[]>;
}

export const safeFetch = async (input: string | URL, options: SafeFetchOptions) => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHostname = options.resolveHostname ??
    ((hostname: string) => resolvePublicAddresses(hostname, fetchImpl));
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 10_000;
  let current = validatePublicUrl(input, options.allowedHosts);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const addresses = await resolveHostname(current.hostname);
    if (addresses.length === 0 || addresses.some((address) => !isPublicIpAddress(address))) {
      throw new RequestSecurityError(
        'The target hostname does not resolve exclusively to public addresses.',
      );
    }

    const response = await fetchImpl(current, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'text/html,text/plain,application/xhtml+xml;q=0.9',
        'user-agent': 'CloudflareSearchBot/1.0',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === maxRedirects) {
        throw new RequestSecurityError('Too many redirects or an invalid redirect.', 502);
      }
      current = validatePublicUrl(new URL(location, current), options.allowedHosts);
      continue;
    }
    if (!response.ok) {
      throw new RequestSecurityError(`Remote server returned HTTP ${response.status}.`, 502);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!['text/html', 'text/plain', 'application/xhtml+xml'].some((type) =>
      contentType.includes(type))) {
      throw new RequestSecurityError('Remote resource is not a supported text document.', 415);
    }
    return {
      url: current,
      contentType,
      text: await readLimitedResponseText(response, maxBytes),
    };
  }
  throw new RequestSecurityError('Unable to fetch URL.', 502);
};

const digest = async (value: string) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

const constantTimeEqual = async (left: string, right: string) => {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }
  return difference === 0;
};

export type ApiSecretName = 'INGEST_TOKEN' | 'CHAT_TOKEN';

export const requireApiAuth = async (
  request: Request,
  runtimeEnv: Pick<Env, ApiSecretName>,
  secretName: ApiSecretName,
): Promise<Response | null> => {
  const expected = runtimeEnv[secretName]?.trim();
  if (!expected) return jsonResponse({ error: 'API authentication is not configured.' }, 503);

  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer ([^\s]{1,4096})$/);
  if (!match || !(await constantTimeEqual(match[1], expected))) {
    return jsonResponse(
      { error: 'Unauthorized.' },
      401,
      { 'www-authenticate': 'Bearer realm="cloudflare-search"' },
    );
  }
  return null;
};

export const enforceRateLimit = async (
  request: Request,
  namespace: KVNamespace | undefined,
  keyPrefix: string,
  limit: number,
  windowMs: number,
): Promise<Response | null> => {
  if (!namespace) return jsonResponse({ error: 'Rate limiting is not configured.' }, 503);

  const client = (request.headers.get('cf-connecting-ip') || 'unknown').slice(0, 128);
  const clientHash = [...await digest(client)]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = `rate:${keyPrefix}:${clientHash}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  let timestamps: number[] = [];
  try {
    const stored = await namespace.get(key, 'json') as unknown;
    if (Array.isArray(stored)) {
      timestamps = stored.filter((item): item is number =>
        typeof item === 'number' && item > cutoff && item <= now);
    }
  } catch {
    return jsonResponse({ error: 'Rate limiting is unavailable.' }, 503);
  }

  if (timestamps.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((timestamps[0] + windowMs - now) / 1_000));
    return jsonResponse(
      { error: 'Too many requests. Try again later.' },
      429,
      { 'retry-after': String(retryAfter) },
    );
  }

  timestamps.push(now);
  try {
    await namespace.put(key, JSON.stringify(timestamps), {
      expirationTtl: Math.max(60, Math.ceil(windowMs / 1_000) + 5),
    });
  } catch {
    return jsonResponse({ error: 'Rate limiting is unavailable.' }, 503);
  }
  return null;
};

export const readJsonBody = async <T>(request: Request, maxBytes: number): Promise<T> => {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestSecurityError('Request body is too large.', 413);
  }
  if (!request.body) throw new RequestSecurityError('A JSON request body is required.');

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestSecurityError('Request body is too large.', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RequestSecurityError('Request body must be valid JSON.');
  }
};
