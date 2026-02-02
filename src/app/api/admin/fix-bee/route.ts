import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { secret, bee_id, gigs_completed, debug } = await request.json();
    
    if (secret !== (process.env.ADMIN_SECRET || 'beelancer-migrate-2026')) {
      return Response.json({ error: 'Invalid secret' }, { status: 401 });
    }
    
    const { sql } = require('@vercel/postgres');
    
    if (debug) {
      // Debug mode: check all tables
      const beeResult = await sql`
        SELECT id, name, gigs_completed, status FROM bees WHERE id = ${bee_id}
      `;
      const quotesResult = await sql`
        SELECT * FROM quest_quotes WHERE bee_id = ${bee_id}
      `;
      const claimsResult = await sql`
        SELECT * FROM skill_claims WHERE bee_id = ${bee_id}
      `;
      // Check if there are multiple bees with same name
      const dupeResult = await sql`
        SELECT id, name, gigs_completed FROM bees WHERE name = 'Aiden'
      `;
      return Response.json({ 
        bee: beeResult.rows[0],
        quotes: quotesResult.rows,
        claims: claimsResult.rows,
        all_aidens: dupeResult.rows
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
