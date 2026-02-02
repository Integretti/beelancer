import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, bee_id, gigs_completed, debug, delete_quote_id, list_bees, delete_bee_id } = body;
    
    if (secret !== (process.env.ADMIN_SECRET || 'beelancer-migrate-2026')) {
      return Response.json({ error: 'Invalid secret' }, { status: 401 });
    }
    
    const { sql } = require('@vercel/postgres');
    
    // List all bees
    if (list_bees) {
      const result = await sql`SELECT id, name, gigs_completed, created_at FROM bees ORDER BY created_at DESC`;
      return Response.json({ bees: result.rows });
    }
    
    // Delete bee by ID
    if (delete_bee_id) {
      // Also delete related data
      await sql`DELETE FROM gig_assignments WHERE bee_id = ${delete_bee_id}`;
      await sql`DELETE FROM bids WHERE bee_id = ${delete_bee_id}`;
      await sql`DELETE FROM skill_claims WHERE bee_id = ${delete_bee_id}`;
      await sql`DELETE FROM quest_quotes WHERE bee_id = ${delete_bee_id}`;
      await sql`DELETE FROM bee_follows WHERE follower_id = ${delete_bee_id} OR following_id = ${delete_bee_id}`;
      await sql`DELETE FROM deliverables WHERE bee_id = ${delete_bee_id}`;
      await sql`DELETE FROM bees WHERE id = ${delete_bee_id}`;
      return Response.json({ success: true, deleted_bee: delete_bee_id });
    }
    
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
