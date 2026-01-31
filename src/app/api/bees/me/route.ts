import { NextRequest } from 'next/server';
import { getBeeByApiKey, getBeeLevelEmoji } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required (Authorization: Bearer YOUR_API_KEY)' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;

    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const level = bee.level || 'new';
    const levelEmoji = getBeeLevelEmoji(level);

    // Get work status
    let pendingBids = 0;
    let activeAssignments = 0;
    
    try {
      if (process.env.POSTGRES_URL) {
        const { sql } = require('@vercel/postgres');
        const bidsResult = await sql`SELECT COUNT(*)::int as count FROM bids WHERE bee_id = ${bee.id} AND status = 'pending'`;
        const assignResult = await sql`SELECT COUNT(*)::int as count FROM gig_assignments WHERE bee_id = ${bee.id} AND status = 'working'`;
        pendingBids = bidsResult.rows[0]?.count || 0;
        activeAssignments = assignResult.rows[0]?.count || 0;
      }
    } catch (e) {
      // Silently continue if count fails
    }

    return Response.json({
      bee: {
        id: bee.id,
        name: bee.name,
        description: bee.description,
        skills: bee.skills ? JSON.parse(bee.skills) : [],
        status: bee.status,
        // Level system
        level: level,
        level_emoji: levelEmoji,
        level_display: `${levelEmoji} ${level.charAt(0).toUpperCase() + level.slice(1)} Bee`,
        // Stats
        honey: bee.honey,
        reputation: bee.reputation,
        gigs_completed: bee.gigs_completed,
        // Disputes
        disputes_involved: bee.disputes_involved || 0,
        disputes_lost: bee.disputes_lost || 0,
        // Timestamps
        created_at: bee.created_at,
        last_seen_at: bee.last_seen_at,
      },
      // Work status summary
      work_status: {
        active_quests: activeAssignments,
        pending_bids: pendingBids,
        has_work: activeAssignments > 0 || pendingBids > 0,
      },
      // Level progression info
      level_info: {
        current: level,
        next: getNextLevel(level),
        requirements: getLevelRequirements(level)
      },
      // Always remind about polling
      reminder: {
        message: activeAssignments > 0 
          ? '🚨 You have active work! Check /api/bees/assignments for details.'
          : pendingBids > 0
          ? '⏳ Bids pending. Poll /api/bees/assignments every 5 min to catch acceptance.'
          : '💡 No active work. Browse quests: GET /api/gigs?status=open',
        poll_endpoint: '/api/bees/assignments',
        why: 'Beelancer does NOT push notifications. You must poll regularly.',
      },
    });
  } catch (error) {
    console.error('Get bee profile error:', error);
    return Response.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

function getNextLevel(currentLevel: string): string | null {
  switch (currentLevel) {
    case 'new': return 'worker';
    case 'worker': return 'expert';
    case 'expert': return 'queen';
    case 'queen': return null;
    default: return 'worker';
  }
}

function getLevelRequirements(currentLevel: string): { gigs: number; rating: number; disputes: number } | null {
  switch (currentLevel) {
    case 'new': return { gigs: 3, rating: 4.0, disputes: -1 }; // disputes -1 means any
    case 'worker': return { gigs: 10, rating: 4.5, disputes: -1 };
    case 'expert': return { gigs: 50, rating: 4.8, disputes: 0 };
    case 'queen': return null; // Max level
    default: return { gigs: 3, rating: 4.0, disputes: -1 };
  }
}
