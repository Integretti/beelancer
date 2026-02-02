import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@vercel/blob', () => ({
  del: vi.fn(async () => undefined),
  put: vi.fn(async () => ({ url: 'https://blob.test/x' })),
}));

const sqlQuery = vi.fn();
vi.mock('@vercel/postgres', () => ({
  sql: { query: (...args: any[]) => sqlQuery(...args) },
}));

function createRequest(url: string, options: RequestInit = {}): NextRequest {
  const fullUrl = `http://localhost:3000${url}`;
  return new NextRequest(fullUrl, options as any);
}

describe('P0 security controls', () => {
  beforeEach(() => {
    sqlQuery.mockReset();
    delete process.env.ADMIN_SECRET;
    delete process.env.CRON_SECRET;
  });

  it('admin endpoints fail closed when ADMIN_SECRET missing', async () => {
    const { POST: migrate } = await import('@/app/api/admin/migrate/route');
    const req = createRequest('/api/admin/migrate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ any: 'payload' }),
    });
    const res = await migrate(req);
    expect(res.status).toBe(500);
  });

  it('cron endpoints fail closed when CRON_SECRET missing', async () => {
    const { GET: autoApprove } = await import('@/app/api/cron/auto-approve/route');
    const req = createRequest('/api/cron/auto-approve', { method: 'GET' });
    const res = await autoApprove(req);
    expect(res.status).toBe(500);
  });

  it('DELETE /api/upload requires auth and forbids non-owner', async () => {
    process.env.CRON_SECRET = 'x'; // irrelevant, just ensuring no accidental reads

    const { DELETE: delUpload } = await import('@/app/api/upload/route');

    // 1) unauthenticated
    const req1 = createRequest('/api/upload', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://blob.test/file.png' }),
    });
    const res1 = await delUpload(req1);
    expect(res1.status).toBe(401);

    // 2) authenticated bee but not uploader and not assigned
    // query sequence: bee lookup, upload lookup, gig lookup
    sqlQuery
      .mockResolvedValueOnce({ rows: [{ id: 'beeA' }] })
      .mockResolvedValueOnce({ rows: [{ blob_url: 'https://blob.test/file.png', uploader_type: 'bee', uploader_id: 'beeB', gig_id: 'gig1' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'user1', assigned_bee_id: 'beeC' }] });

    const req2 = createRequest('/api/upload', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer bee_key' },
      body: JSON.stringify({ url: 'https://blob.test/file.png' }),
    });
    const res2 = await delUpload(req2);
    expect(res2.status).toBe(403);

    // 3) authenticated as uploader (owner)
    const { del } = await import('@vercel/blob');
    sqlQuery
      .mockResolvedValueOnce({ rows: [{ id: 'beeB' }] })
      .mockResolvedValueOnce({ rows: [{ blob_url: 'https://blob.test/file.png', uploader_type: 'bee', uploader_id: 'beeB', gig_id: 'gig1' }] })
      .mockResolvedValueOnce({ rows: [] }); // delete record

    const req3 = createRequest('/api/upload', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'authorization': 'Bearer bee_key2' },
      body: JSON.stringify({ url: 'https://blob.test/file.png' }),
    });
    const res3 = await delUpload(req3);
    expect(res3.status).toBe(200);
    expect(del).toHaveBeenCalled();
  });
});
