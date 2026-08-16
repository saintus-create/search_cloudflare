import { describe, expect, it } from 'vitest';
import {
  enforceRateLimit,
  isPublicIpAddress,
  parseAllowedHosts,
  RequestSecurityError,
  requireApiAuth,
  safeFetch,
  validatePublicUrl,
} from '../../src/lib/security';

describe('IP and URL policy', () => {
  it.each([
    '127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.169.254',
    '172.16.0.1', '192.168.1.1', '198.18.0.1', '::1', 'fc00::1', 'fe80::1',
  ])('rejects non-public address %s', (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])
    ('accepts public address %s', (address) => {
      expect(isPublicIpAddress(address)).toBe(true);
    });

  it('requires an exact allowlisted host and standard port', () => {
    const hosts = parseAllowedHosts('docs.example.org');
    expect(validatePublicUrl('https://docs.example.org/page#fragment', hosts).hash).toBe('');
    expect(() => validatePublicUrl('https://evil.example/page', hosts)).toThrow(RequestSecurityError);
    expect(() => validatePublicUrl('https://docs.example.org:8443/page', hosts)).toThrow(RequestSecurityError);
  });
});

describe('safeFetch', () => {
  const publicResolver = async () => ['8.8.8.8'];

  it('revalidates redirect destinations', async () => {
    const fetchImpl = async () => new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/private' },
    });
    await expect(safeFetch('https://docs.example.org/start', {
      allowedHosts: parseAllowedHosts('docs.example.org'),
      resolveHostname: publicResolver,
      fetchImpl,
    })).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a resolver result that changes to a private address', async () => {
    await expect(safeFetch('https://docs.example.org/start', {
      allowedHosts: parseAllowedHosts('docs.example.org'),
      resolveHostname: async () => ['127.0.0.1'],
      fetchImpl: async () => new Response('never reached'),
    })).rejects.toBeInstanceOf(RequestSecurityError);
  });

  it('bounds and accepts a supported text response', async () => {
    const value = await safeFetch('https://docs.example.org/start', {
      allowedHosts: parseAllowedHosts('docs.example.org'),
      resolveHostname: publicResolver,
      fetchImpl: async () => new Response('evidence', {
        headers: { 'content-type': 'text/plain' },
      }),
    });
    expect(value.text).toBe('evidence');
  });
});

describe('rate limiting', () => {
  it('fails closed when the KV binding is unavailable', async () => {
    const response = await enforceRateLimit(requestWithIp(), undefined, 'chat', 1, 60_000);
    expect(response?.status).toBe(503);
  });

  it('returns 429 when the sliding window is exhausted', async () => {
    const namespace = {
      get: async () => [Date.now()],
      put: async () => undefined,
    } as unknown as KVNamespace;
    const response = await enforceRateLimit(requestWithIp(), namespace, 'chat', 1, 60_000);
    expect(response?.status).toBe(429);
    expect(response?.headers.get('retry-after')).toBeTruthy();
  });

  const requestWithIp = () => new Request('https://app.example/api/chat', {
    headers: { 'cf-connecting-ip': '203.0.113.10' },
  });
});

describe('authentication', () => {
  const request = (authorization?: string) => new Request('https://app.example/api/chat', {
    headers: authorization ? { authorization } : {},
  });
  const runtimeEnv = (token: string | undefined) => ({ CHAT_TOKEN: token }) as Env;

  it('fails closed when the secret is not configured', async () => {
    expect((await requireApiAuth(request(), runtimeEnv(undefined), 'CHAT_TOKEN'))?.status).toBe(503);
  });

  it('rejects missing or invalid bearer credentials', async () => {
    expect((await requireApiAuth(request(), runtimeEnv('expected'), 'CHAT_TOKEN'))?.status).toBe(401);
    expect((await requireApiAuth(request('Bearer wrong'), runtimeEnv('expected'), 'CHAT_TOKEN'))?.status).toBe(401);
  });

  it('accepts the configured bearer credential', async () => {
    expect(await requireApiAuth(
      request('Bearer expected'), runtimeEnv('expected'), 'CHAT_TOKEN',
    )).toBeNull();
  });
});
