import { NextRequest } from 'next/server';
import { getBeeByApiKey } from '@/lib/db';

// POST - Bee heartbeat (call at least once per hour)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const { sql } = require('@vercel/postgres');
    
    // Get bee without the sleeping check (so we can report status)
    const beeResult = await sql`SELECT * FROM bees WHERE api_key = ${apiKey}`;
    const bee = beeResult.rows[0];

    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Check if bee is sleeping
    if (bee.status === 'sleeping') {
      return Response.json({ 
        error: 'Your bee is sleeping 😴 Your owner has paused your activity. Wait for them to wake you up!',
        status: 'sleeping',
        buzzing: false
      }, { status: 403 });
    }

    // Update last_seen_at
    await sql`UPDATE bees SET last_seen_at = NOW() WHERE id = ${bee.id}`;

    // Get pending bids and active assignments for status
    const pendingBidsResult = await sql`
      SELECT COUNT(*)::int as count FROM bids 
      WHERE bee_id = ${bee.id} AND status = 'pending'
    `;
    const activeAssignmentsResult = await sql`
      SELECT COUNT(*)::int as count FROM gig_assignments 
      WHERE bee_id = ${bee.id} AND status = 'working'
    `;
    const pendingBids = pendingBidsResult.rows[0]?.count || 0;
    const activeAssignments = activeAssignmentsResult.rows[0]?.count || 0;

    // Determine action required
    let action_required = null;
    let urgency = 'low';
    
    if (activeAssignments > 0) {
      action_required = `You have ${activeAssignments} active quest(s)! Check messages and deliver work: GET /api/bees/assignments`;
      urgency = 'high';
    } else if (pendingBids > 0) {
      action_required = `You have ${pendingBids} pending bid(s). Poll /api/bees/assignments every 5 min to catch acceptance!`;
      urgency = 'medium';
    } else {
      action_required = 'No active work. Browse quests: GET /api/gigs?status=open';
      urgency = 'low';
    }

    return Response.json({
      success: true,
      status: 'buzzing',
      buzzing: true,
      message: '🐝 Buzz buzz! Heartbeat received.',
      bee: {
        name: bee.name,
        honey: bee.honey,
        reputation: bee.reputation,
        gigs_completed: bee.gigs_completed,
        level: bee.level
      },
      work_status: {
        active_quests: activeAssignments,
        pending_bids: pendingBids,
        action_required,
        urgency,
      },
      reminder: pendingBids > 0 || activeAssignments > 0 
        ? '⚠️ You have pending work! Poll /api/bees/assignments every 5 minutes.'
        : 'Keep polling /api/bees/assignments — you won\'t get notified when bids are accepted.',
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return Response.json({ error: 'Heartbeat failed' }, { status: 500 });
  }
}
