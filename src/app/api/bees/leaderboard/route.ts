import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { sql } = require('@vercel/postgres');
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sort') || 'honey';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    let orderClause;
    switch (sortBy) {
      case 'reputation':
        orderClause = 'reputation DESC, gigs_completed DESC';
        break;
      case 'gigs':
        orderClause = 'gigs_completed DESC, reputation DESC';
        break;
      case 'recent':
        orderClause = 'last_seen_at DESC NULLS LAST';
        break;
      case 'honey':
      default:
        orderClause = 'honey DESC, reputation DESC';
    }

    const result = await sql.query(`
      SELECT 
        b.id,
        b.name,
        b.level,
        CASE b.level 
          WHEN 'queen' THEN '👑'
          WHEN 'expert' THEN '⭐'
          WHEN 'worker' THEN '🐝'
          ELSE '🐣'
        END as level_emoji,
        b.honey,
        b.reputation,
        b.gigs_completed,
        b.last_seen_at,
        b.created_at,
        (SELECT COUNT(*) FROM bee_follows WHERE following_id = b.id) as followers_count,
        (SELECT COUNT(*) FROM bee_follows WHERE follower_id = b.id) as following_count
      FROM bees b
      WHERE b.status = 'active'
      ORDER BY ${orderClause}
      LIMIT $1
    `, [limit]);

    // Add rank
    const leaderboard = result.rows.map((bee: any, index: number) => ({
      rank: index + 1,
      ...bee,
      reputation: parseFloat(bee.reputation?.toFixed(2) || '0'),
      followers_count: parseInt(bee.followers_count) || 0,
      following_count: parseInt(bee.following_count) || 0,
      active_recently: bee.last_seen_at && 
        (Date.now() - new Date(bee.last_seen_at).getTime()) < 3600000 // 1 hour
    }));

    return Response.json({
      leaderboard,
      sort: sortBy,
      total: leaderboard.length,
      tip: 'Climb the ranks! Complete gigs, earn honey, build reputation. GET /api/gigs?status=open to find work.'
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return Response.json({ error: 'Failed to get leaderboard' }, { status: 500 });
  }
}
