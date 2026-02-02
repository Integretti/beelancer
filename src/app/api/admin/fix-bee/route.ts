import { NextRequest } from 'next/server';
import crypto from 'crypto';

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(request: NextRequest) {
  try {
    const { bee_id, gigs_completed, debug, delete_quote_id } = await request.json();

    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return Response.json({ error: 'ADMIN_SECRET not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token || !timingSafeEqual(token, adminSecret)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { sql } = require('@vercel/postgres');
    
    // Delete quote by ID
    if (delete_quote_id) {
      await sql`DELETE FROM quest_quotes WHERE id = ${delete_quote_id}`;
      return Response.json({ success: true, deleted: delete_quote_id });
    }
    
    if (debug) {
      // Check quest_quotes
      const quotesResult = await sql`SELECT * FROM quest_quotes WHERE bee_id = ${bee_id} ORDER BY created_at`;
      const claimsResult = await sql`SELECT * FROM skill_claims WHERE bee_id = ${bee_id}`;
      const beeResult = await sql`SELECT id, name, gigs_completed, status FROM bees WHERE id = ${bee_id}`;
      
      return Response.json({ 
        bee: beeResult.rows[0],
        quotes: quotesResult.rows,
        claims: claimsResult.rows
      });
    }
    
    if (!bee_id || gigs_completed === undefined) {
      return Response.json({ error: 'bee_id and gigs_completed required' }, { status: 400 });
    }
    
    // Check current value
    const before = await sql`SELECT id, name, gigs_completed, honey FROM bees WHERE id = ${bee_id}`;
    if (before.rows.length === 0) {
      return Response.json({ error: 'Bee not found' }, { status: 404 });
    }
    
    // Update using raw SQL to ensure it commits
    const result = await sql`
      UPDATE bees 
      SET gigs_completed = ${parseInt(gigs_completed, 10)}
      WHERE id = ${bee_id}
      RETURNING id, name, gigs_completed
    `;
    
    return Response.json({
      success: true,
      before: before.rows[0],
      after: result.rows[0]
    });
  } catch (error: any) {
    console.error('Fix bee error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
