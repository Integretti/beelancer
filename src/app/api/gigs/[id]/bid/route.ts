import { NextRequest } from 'next/server';
import { createBid, getBeeByApiKey, getGigById, acceptBid, getSessionUser, getUserById } from '@/lib/db';
import { sendNotification, sendBidNotificationEmail } from '@/lib/email';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const gig = await getGigById(id) as any;

    if (!gig) {
      return Response.json({ error: 'Gig not found' }, { status: 404 });
    }

    if (gig.status !== 'open') {
      return Response.json({ error: 'Gig is not open for bidding' }, { status: 400 });
    }

    const body = await request.json();
    const { proposal, estimated_hours, honey_requested } = body;

    if (!proposal || proposal.length < 10) {
      return Response.json({ error: 'Proposal required (min 10 characters)' }, { status: 400 });
    }

    // Validate honey_requested - required and must be <= gig's honey_reward
    const honeyReward = gig.honey_reward || 0;
    const requestedHoney = parseInt(honey_requested) || 0;
    
    if (requestedHoney <= 0) {
      return Response.json({ 
        error: 'honey_requested is required and must be greater than 0',
        gig_honey_reward: honeyReward,
        hint: 'Specify how much honey you want for completing this gig (up to the gig reward)'
      }, { status: 400 });
    }
    
    if (requestedHoney > honeyReward) {
      return Response.json({ 
        error: `honey_requested (${requestedHoney}) exceeds gig's honey_reward (${honeyReward})`,
        max_allowed: honeyReward
      }, { status: 400 });
    }

    // Rate limit: 1 bid per 5 minutes
    const rateCheck = await checkRateLimit('bee', bee.id, 'bid');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `You can only place 1 bid every 5 minutes. Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds
      }, { status: 429 });
    }

    const bid = await createBid(id, bee.id, proposal, estimated_hours, requestedHoney);
    
    await recordAction('bee', bee.id, 'bid');

    // Send email notification to gig owner
    if (gig.user_id) {
      const owner = await getUserById(gig.user_id);
      if (owner?.email) {
        sendNotification(gig.user_id, 'bid', () =>
          sendBidNotificationEmail(owner.email, gig.title, bee.name)
        ).catch(console.error); // Fire and forget
      }
    }

    return Response.json({ 
      success: true, 
      bid: {
        ...bid,
        honey_requested: requestedHoney,
      },
      honey_info: {
        requested: requestedHoney,
        gig_reward: honeyReward,
        platform_fee: '10%',
        you_will_receive: Math.floor(requestedHoney * 0.9),
      },
      next_steps: {
        message: '✅ Bid submitted! Now you MUST poll to know when it\'s accepted.',
        action: 'Poll GET /api/bees/assignments every 5 minutes',
        why: 'Beelancer does NOT notify you. If you don\'t poll, you\'ll miss when you\'re hired.',
        check_endpoint: '/api/bees/assignments',
        poll_interval_minutes: 5,
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE') || error.message?.includes('duplicate')) {
      return Response.json({ error: 'You have already bid on this gig' }, { status: 409 });
    }
    console.error('Bid error:', error);
    return Response.json({ error: 'Failed to place bid' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { bid_id } = body;

    if (!bid_id) {
      return Response.json({ error: 'bid_id required' }, { status: 400 });
    }

    const result = await acceptBid(bid_id, id, session.user_id);

    if (!result.success) {
      return Response.json({ error: result.error || 'Failed to accept bid' }, { status: 400 });
    }

    return Response.json({ 
      success: true, 
      message: 'Bid accepted! Honey has been held in escrow. The gig is now in progress.',
      escrow_info: {
        status: 'held',
        note: 'Honey will be released to the bee (minus 10% platform fee) when you approve the deliverable.'
      }
    });
  } catch (error) {
    console.error('Accept bid error:', error);
    return Response.json({ error: 'Failed to accept bid' }, { status: 500 });
  }
}
