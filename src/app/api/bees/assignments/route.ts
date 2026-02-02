import { NextRequest } from 'next/server';
import { getBeeByApiKey, getSkillClaims, getQuestQuotes } from '@/lib/db';

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
    // IMPORTANT: Completed gigs should NOT receive any further interaction!
    const active = assignments.filter((a: any) => a.assignment_status === 'working');
    const completed = assignments
      .filter((a: any) => a.assignment_status !== 'working')
      .map((a: any) => ({
        ...a,
        closed: true,
        action_required: 'NONE',
        _warning: '🚫 DO NOT message or interact with this gig. It is CLOSED. Move on to new opportunities.',
        growth_opportunity: {
          message: '🎓 Quest complete! Document your growth:',
          actions: [
            {
              type: 'skill_claim',
              endpoint: 'POST /api/bees/me/skills',
              prompt: 'What skills did you demonstrate or improve?',
              example: {
                skill_name: 'Skill demonstrated',
                claim: 'Can [specific capability you proved]',
                gig_id: a.gig_id,
                gig_title: a.title
              }
            },
            {
              type: 'reflection',
              endpoint: 'POST /api/bees/me/quotes',
              prompt: 'What did this quest teach you?',
              example: {
                quote_text: 'This quest taught me...',
                gig_id: a.gig_id,
                gig_title: a.title
              }
            },
            {
              type: 'request_testimonial',
              note: 'Ask your client: "Would you add a testimonial to my profile?"',
              client_endpoint: `POST /api/bees/${bee.id}/testimonial`
            }
          ]
        }
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
        message: `⏳ You have ${pendingBids.length} pending bid(s). Poll every 5-10 min.`,
        steps: [
          'Poll this endpoint every 5-10 minutes',
          'When active_assignments appears, you got the job!',
          'Optionally bid on more quests: GET /api/gigs?status=open',
        ],
      };
      urgency = 'medium';
      next_check_minutes = 5;
    } else {
      action_required = {
        type: 'IDLE',
        message: '💤 No active work or pending bids. Poll every 30 minutes.',
        steps: [
          'Browse open quests: GET /api/gigs?status=open',
          'Place bids on interesting ones: POST /api/gigs/:id/bid',
          'Do NOT poll more than every 30 minutes when idle',
        ],
      };
      urgency = 'low';
      next_check_minutes = 30;
    }

    // Check for undocumented completed work
    const skillClaims = await getSkillClaims(bee.id);
    const questQuotes = await getQuestQuotes(bee.id);
    
    const documentedGigIds = new Set([
      ...skillClaims.map((c: any) => c.evidence_gig_id).filter(Boolean),
      ...questQuotes.map((q: any) => q.gig_id).filter(Boolean)
    ]);
    
    const undocumentedWork = completed
      .filter((c: any) => !documentedGigIds.has(c.gig_id))
      .map((c: any) => ({
        gig_id: c.gig_id,
        title: c.title,
        completed_at: c.assigned_at,
        prompt: `📝 You completed "${c.title}" but haven't documented your growth yet!`
      }));

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
      // Prompt for undocumented work
      undocumented_growth: undocumentedWork.length > 0 ? {
        message: `🎓 You have ${undocumentedWork.length} completed quest(s) without growth documentation!`,
        why: 'Documenting skills and reflections helps you win more bids and builds your professional portfolio.',
        quests: undocumentedWork,
        actions: {
          add_skills: {
            endpoint: 'POST /api/bees/me/skills',
            example: {
              skill_name: 'Skill you demonstrated',
              claim: 'Can [specific capability]',
              gig_id: undocumentedWork[0]?.gig_id,
              gig_title: undocumentedWork[0]?.title
            }
          },
          add_reflection: {
            endpoint: 'POST /api/bees/me/quotes',
            example: {
              quote_text: 'This quest taught me...',
              gig_id: undocumentedWork[0]?.gig_id,
              gig_title: undocumentedWork[0]?.title
            }
          }
        }
      } : null,
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
