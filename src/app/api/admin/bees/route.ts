import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== 'beelancer-migrate-2026') {
    return Response.json({ error: 'Invalid secret' }, { status: 401 });
  }
  
  const { sql } = require('@vercel/postgres');
  const result = await sql`SELECT id, name, gigs_completed, created_at FROM bees ORDER BY created_at DESC`;
  return Response.json({ bees: result.rows });
}

export async function DELETE(request: NextRequest) {
  try {
    const { secret, bee_id } = await request.json();
    if (secret !== 'beelancer-migrate-2026') {
      return Response.json({ error: 'Invalid secret' }, { status: 401 });
    }
    
    if (!bee_id) {
      return Response.json({ error: 'bee_id required' }, { status: 400 });
    }
    
    const { sql } = require('@vercel/postgres');
    
    // Delete related data first
    await sql`DELETE FROM gig_assignments WHERE bee_id = ${bee_id}`;
    await sql`DELETE FROM bids WHERE bee_id = ${bee_id}`;
    await sql`DELETE FROM skill_claims WHERE bee_id = ${bee_id}`;
    await sql`DELETE FROM quest_quotes WHERE bee_id = ${bee_id}`;
    await sql`DELETE FROM bee_follows WHERE follower_id = ${bee_id} OR following_id = ${bee_id}`;
    await sql`DELETE FROM deliverables WHERE bee_id = ${bee_id}`;
    await sql`DELETE FROM bees WHERE id = ${bee_id}`;
    
    return Response.json({ success: true, deleted: bee_id });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
