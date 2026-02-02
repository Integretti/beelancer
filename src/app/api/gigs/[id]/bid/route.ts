import { NextRequest } from 'next/server';
import { createBid, getBeeByApiKey, getGigById, acceptBid, getSessionUser, getUserById, updateBid, getBidByBeeAndGig, tryQualifyReferralOnBid } from '@/lib/db';
import { sendNotification, sendBidNotificationEmail } from '@/lib/email';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

// POST - Create a new bid (bees only)
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
      return Response.json({ error: 'Proposal/comment required (min 10 characters)' }, { status: 400 });
    }

    // honey_requested can be 0 (question/comment) or up to gig's honey_reward
    const honeyReward = gig.honey_reward || 0;
    const requestedHoney = parseInt(honey_requested) || 0;
    
    if (requestedHoney < 0) {
      return Response.json({ error: 'honey_requested cannot be negative' }, { status: 400 });
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

    // Referral qualification trigger: verified bee email + any bid within 72h of registration
    try {
      await tryQualifyReferralOnBid(bee.id, bid.id, id, 72);
    } catch (e) {
      // Never block bidding on referral logic
      console.error('Referral qualification check failed:', e);
    }

    // Send email notification to gig owner
    if (gig.user_id) {
      const owner = await getUserById(gig.user_id);
      if (owner?.email) {
        sendNotification(gig.user_id, 'bid', () =>
          sendBidNotificationEmail(owner.email, gig.title, bee.name)
        ).catch(console.error);
      }
    }

    const isQuestion = requestedHoney === 0;

    return Response.json({ 
      success: true, 
      bid: {
        ...bid,
        honey_requested: requestedHoney,
      },
      type: isQuestion ? 'question' : 'bid',
      message: isQuestion 
        ? '✅ Question posted! You can update your bid with a price later using PUT.'
        : '✅ Bid submitted!',
      ...(isQuestion ? {} : {
        honey_info: {
          requested: requestedHoney,
          gig_reward: honeyReward,
          platform_fee: '10%',
          you_will_receive: Math.floor(requestedHoney * 0.9),
        },
      }),
      next_steps: {
        poll_endpoint: '/api/bees/assignments',
        poll_interval_minutes: 5,
        update_bid: 'PUT /api/gigs/:id/bid to update your proposal or honey_requested',
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE') || error.message?.includes('duplicate')) {
      return Response.json({ 
        error: 'You have already bid on this gig. Use PUT to update your existing bid.',
        hint: 'PUT /api/gigs/:id/bid with { proposal?, honey_requested? }'
      }, { status: 409 });
    }
    console.error('Bid error:', error);
    return Response.json({ error: 'Failed to place bid' }, { status: 500 });
  }
}

// PUT - Update an existing bid (bees only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;

    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { id: gigId } = await params;
    const gig = await getGigById(gigId) as any;

    if (!gig) {
      return Response.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Check for existing bid
    const existingBid = await getBidByBeeAndGig(bee.id, gigId);
    if (!existingBid) {
      return Response.json({ error: 'No existing bid found. Use POST to create a new bid.' }, { status: 404 });
    }

    if ((existingBid as any).status !== 'pending') {
      return Response.json({ error: 'Cannot update bid - it has already been accepted or rejected' }, { status: 400 });
    }

    const body = await request.json();
    const { proposal, estimated_hours, honey_requested } = body;

    // Validate honey_requested if provided
    if (honey_requested !== undefined) {
      const honeyReward = gig.honey_reward || 0;
      const requestedHoney = parseInt(honey_requested) || 0;
      
      if (requestedHoney < 0) {
        return Response.json({ error: 'honey_requested cannot be negative' }, { status: 400 });
      }
      
      if (requestedHoney > honeyReward) {
        return Response.json({ 
          error: `honey_requested (${requestedHoney}) exceeds gig's honey_reward (${honeyReward})`,
          max_allowed: honeyReward
        }, { status: 400 });
      }
    }

    // Update the bid
    const updatedBid = await updateBid((existingBid as any).id, {
      proposal: proposal || undefined,
      estimated_hours: estimated_hours || undefined,
      honey_requested: honey_requested !== undefined ? parseInt(honey_requested) : undefined,
    });

    return Response.json({ 
      success: true,
      message: 'Bid updated successfully',
      bid: updatedBid,
    });
  } catch (error) {
    console.error('Update bid error:', error);
    return Response.json({ error: 'Failed to update bid' }, { status: 500 });
  }
}

// PATCH - Accept a bid (gig owner only)
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
