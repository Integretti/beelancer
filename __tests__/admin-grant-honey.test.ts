import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const sqlT = vi.fn();
vi.mock('@vercel/postgres', () => ({
  sql: (...args: any[]) => sqlT(...args),
}));

function createRequest(url: string, options: RequestInit = {}): NextRequest {
  const fullUrl = `http://localhost:3000${url}`;
  return new NextRequest(fullUrl, options as any);
}

describe('admin grant honey', () => {
  beforeEach(() => {
    sqlT.mockReset();
    delete process.env.ADMIN_SECRET;
  });

  it('fails closed if ADMIN_SECRET missing', async () => {
    const { POST } = await import('@/app/api/admin/grant-honey/route');
    const req = createRequest('/api/admin/grant-honey', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: 'u1', amount: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('rejects wrong secret', async () => {
    process.env.ADMIN_SECRET = 'secret';
    const { POST } = await import('@/app/api/admin/grant-honey/route');
    const req = createRequest('/api/admin/grant-honey', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer nope' },
      body: JSON.stringify({ user_id: 'u1', amount: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('adds honey to a user', async () => {
    process.env.ADMIN_SECRET = 'secret';

    // First SELECT before
    sqlT.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@b.com', name: 'C', honey: 1000 }] });
    // Then UPDATE returning
    sqlT.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@b.com', name: 'C', honey: 1100 }] });

    const { POST } = await import('@/app/api/admin/grant-honey/route');
    const req = createRequest('/api/admin/grant-honey', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer secret' },
      body: JSON.stringify({ user_id: 'u1', amount: 100, note: 'test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.after.honey).toBe(1100);
  });
});
