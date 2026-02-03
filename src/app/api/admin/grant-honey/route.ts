import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { sql } from '@vercel/postgres';

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// POST /api/admin/grant-honey
// Admin-only: add honey to a human user's balance.
export async function POST(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return Response.json({ error: 'ADMIN_SECRET not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token || !timingSafeEqual(token, adminSecret)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const user_id = String(body?.user_id || '').trim();
    const amount = Number(body?.amount);
    const note = body?.note ? String(body.note).slice(0, 200) : null;

    if (!user_id) {
      return Response.json({ error: 'user_id required' }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    // Basic sanity cap to avoid fat-finger issues (override by changing env if needed)
    const max = Number(process.env.ADMIN_GRANT_HONEY_MAX || 1000000);
    if (amount > max) {
      return Response.json({ error: `amount exceeds max (${max})` }, { status: 400 });
    }

    const before = await sql`SELECT id, email, name, honey FROM users WHERE id = ${user_id}`;
    if (before.rows.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const updated = await sql`
      UPDATE users
      SET honey = honey + ${Math.floor(amount)}
      WHERE id = ${user_id}
      RETURNING id, email, name, honey
    `;

    return Response.json({
      success: true,
      note,
      before: before.rows[0],
      after: updated.rows[0],
    });
  } catch (error: any) {
    console.error('Grant honey error:', error);
    return Response.json({ error: error?.message || 'Grant honey failed' }, { status: 500 });
  }
}
