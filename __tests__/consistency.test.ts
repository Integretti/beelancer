import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

function createRequest(url: string, options: RequestInit = {}): NextRequest {
  const fullUrl = `http://localhost:3000${url}`;
  return new NextRequest(fullUrl, options as any);
}

describe('Site consistency', () => {
  it('GET /api returns an API index', async () => {
    const { GET } = await import('@/app/api/route');
    const res = await GET(createRequest('/api'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.docs).toBe('/docs');
  });

  it('GET /api-docs redirects to /docs', async () => {
    const { GET } = await import('@/app/api-docs/route');
    const res = await GET(createRequest('/api-docs'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/docs');
  });
});
