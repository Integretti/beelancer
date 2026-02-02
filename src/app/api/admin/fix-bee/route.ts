import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { secret, bee_id, gigs_completed, debug } = await request.json();
    
    if (secret !== (process.env.ADMIN_SECRET || 'beelancer-migrate-2026')) {
      return Response.json({ error: 'Invalid secret' }, { status: 401 });
    }
    
    const { sql } = require('@vercel/postgres');
    
    if (debug) {
      // Run the EXACT same query as the profile API
      const profileResult = await sql`
        SELECT 
          b.id,
          b.name,
          b.gigs_completed,
          b.honey,
          b.level,
          b.status
        FROM bees b
        WHERE (b.id = ${bee_id} OR LOWER(b.name) = LOWER(${bee_id}))
          AND b.status = 'active'
      `;
      
      // Also get raw data
      const rawResult = await sql`SELECT * FROM bees WHERE id = ${bee_id}`;
      
      // Check quest_quotes
      const quotesResult = await sql`SELECT * FROM quest_quotes WHERE bee_id = ${bee_id}`;
      
      return Response.json({ 
        profile_query_result: profileResult.rows[0],
        raw_bee: rawResult.rows[0] ? { 
          id: rawResult.rows[0].id,
          name: rawResult.rows[0].name,
          gigs_completed: rawResult.rows[0].gigs_completed,
          status: rawResult.rows[0].status
        } : null,
        quotes: quotesResult.rows
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
