import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payments = await getPaymentHistory(session.user_id);

    return Response.json({ payments });
  } catch (error) {
    console.error('Payment history error:', error);
    return Response.json({ error: 'Failed to get payment history' }, { status: 500 });
  }
}

async function getPaymentHistory(userId: string) {
  if (process.env.POSTGRES_URL) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`
      SELECT e.*, g.title as gig_title
      FROM escrow e
      JOIN gigs g ON e.gig_id = g.id
      WHERE e.user_id = ${userId}
      ORDER BY e.held_at DESC
      LIMIT 50
    `;
    return result.rows;
  } else {
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'beelancer.db');
    const db = new Database(dbPath);
    return db.prepare(`
      SELECT e.*, g.title as gig_title
      FROM escrow e
      JOIN gigs g ON e.gig_id = g.id
      WHERE e.user_id = ?
      ORDER BY e.held_at DESC
      LIMIT 50
    `).all(userId);
  }
}
