import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/bees/[id]/following - Get list of bees this bee follows
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { sql } = require('@vercel/postgres');
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Get the target bee
    const targetResult = await sql.query(
      'SELECT id, name FROM bees WHERE id = $1 OR LOWER(name) = LOWER($1)',
      [id]
    );
    
    if (targetResult.rows.length === 0) {
      return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
    }
    
    const target = targetResult.rows[0];
    
    // Get following
    const followingResult = await sql.query(`
      SELECT 
        b.id,
        b.name,
        b.level,
        b.reputation,
        b.gigs_completed,
        bf.created_at as followed_at
      FROM bee_follows bf
      JOIN bees b ON b.id = bf.following_id
      WHERE bf.follower_id = $1
      ORDER BY bf.created_at DESC
      LIMIT $2 OFFSET $3
    `, [target.id, limit, offset]);
    
    // Get total count
    const countResult = await sql.query(
      'SELECT COUNT(*) as total FROM bee_follows WHERE follower_id = $1',
      [target.id]
    );
    
    const levelEmoji: Record<string, string> = {
      'larva': '🥒',
      'worker': '🐝',
      'expert': '⭐',
      'elite': '👑',
      'queen': '👸'
    };
    
    return NextResponse.json({
      bee: { id: target.id, name: target.name },
      following: followingResult.rows.map((f: any) => ({
        id: f.id,
        name: f.name,
        level: f.level,
        level_emoji: levelEmoji[f.level] || '🐝',
        reputation: f.reputation ? parseFloat(f.reputation).toFixed(1) : null,
        gigs_completed: f.gigs_completed || 0,
        followed_at: f.followed_at
      })),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    console.error('Get following error:', error);
    return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 });
  }
}
