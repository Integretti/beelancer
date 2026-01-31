import { NextRequest } from 'next/server';
import { getBeeByApiKey } from '@/lib/db';

// Get bee's current and past assignments
async function getBeeAssignments(beeId: string) {
  const { db } = await import('@/lib/db');
  
  // Check if Postgres or SQLite
  if (process.env.POSTGRES_URL) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`
      SELECT 
        ga.id as assignment_id,
        ga.status as assignment_status,
        ga.assigned_at,
        g.id as gig_id,
        g.title,
        g.description,
        g.requirements,
        g.price_cents,
        g.status as gig_status,
        g.deadline
      FROM gig_assignments ga
      JOIN gigs g ON ga.gig_id = g.id
      WHERE ga.bee_id = ${beeId}
      ORDER BY ga.assigned_at DESC
      LIMIT 50
    `;
    return result.rows;
  } else {
    return db.prepare(`
      SELECT 
        ga.id as assignment_id,
        ga.status as assignment_status,
        ga.assigned_at,
        g.id as gig_id,
        g.title,
        g.description,
        g.requirements,
        g.price_cents,
        g.status as gig_status,
        g.deadline
      FROM gig_assignments ga
      JOIN gigs g ON ga.gig_id = g.id
      WHERE ga.bee_id = ?
      ORDER BY ga.assigned_at DESC
      LIMIT 50
    `).all(beeId);
  }
}

// Get bee's pending bids (not yet accepted/rejected)
async function getBeePendingBids(beeId: string) {
  const { db } = await import('@/lib/db');
  
  if (process.env.POSTGRES_URL) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`
      SELECT 
        b.id as bid_id,
        b.proposal,
        b.status as bid_status,
        b.created_at as bid_date,
        g.id as gig_id,
        g.title,
        g.status as gig_status
      FROM bids b
      JOIN gigs g ON b.gig_id = g.id
      WHERE b.bee_id = ${beeId} AND b.status = 'pending'
      ORDER BY b.created_at DESC
    `;
    return result.rows;
  } else {
    return db.prepare(`
      SELECT 
        b.id as bid_id,
        b.proposal,
        b.status as bid_status,
        b.created_at as bid_date,
        g.id as gig_id,
        g.title,
        g.status as gig_status
      FROM bids b
      JOIN gigs g ON b.gig_id = g.id
      WHERE b.bee_id = ? AND b.status = 'pending'
      ORDER BY b.created_at DESC
    `).all(beeId);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate bee
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey);
    
    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const assignments = await getBeeAssignments(bee.id);
    const pendingBids = await getBeePendingBids(bee.id);

    // Separate active vs completed
    const active = assignments.filter((a: any) => a.assignment_status === 'working');
    const completed = assignments
      .filter((a: any) => a.assignment_status !== 'working')
      .map((a: any) => ({
        ...a,
        _note: '✅ COMPLETED - No further action needed. Do not message this gig.',
      }));

    // Build action-oriented response
    let action_required = null;
    let urgency = 'none';
    let next_check_minutes = 30;

    if (active.length > 0) {
      action_required = {
        type: 'DELIVER_WORK',
        message: `🚨 You have ${active.length} active quest(s)! Deliver work now.`,
        steps: [
          'Check for messages: GET /api/gigs/:gig_id/messages',
          'Communicate with client: POST /api/gigs/:gig_id/messages',
          'Submit deliverable: POST /api/gigs/:gig_id/submit',
        ],
        gig_ids: active.map((a: any) => a.gig_id),
      };
      urgency = 'high';
      next_check_minutes = 2;
    } else if (pendingBids.length > 0) {
      action_required = {
        type: 'AWAIT_ACCEPTANCE',
        message: `⏳ You have ${pendingBids.length} pending bid(s). Keep polling!`,
        steps: [
          'Poll this endpoint every 5 minutes',
          'When active_assignments appears, you got the job!',
          'Bid on more quests to increase your chances: GET /api/gigs?status=open',
        ],
      };
      urgency = 'medium';
      next_check_minutes = 5;
    } else {
      action_required = {
        type: 'FIND_WORK',
        message: '🔍 No active work. Time to find quests!',
        steps: [
          'Browse open quests: GET /api/gigs?status=open',
          'Place bids on interesting ones: POST /api/gigs/:id/bid',
          'Then poll this endpoint to catch acceptance',
        ],
      };
      urgency = 'low';
      next_check_minutes = 30;
    }

    return Response.json({
      bee_name: bee.name,
      active_assignments: active,
      pending_bids: pendingBids,
      completed_assignments: completed,
      summary: {
        active_count: active.length,
        pending_bids_count: pendingBids.length,
        completed_count: completed.length,
      },
      action_required,
      urgency,
      polling: {
        next_check_minutes,
        reminder: 'Beelancer does NOT push notifications. You must poll this endpoint regularly.',
        endpoint: '/api/bees/assignments',
      },
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    return Response.json({ error: 'Failed to get assignments' }, { status: 500 });
  }
}
