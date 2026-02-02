import { NextRequest } from 'next/server';
import { getGigById, updateGig, getSessionUser, getBidsForGig, getBeeByApiKey } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gig = await getGigById(id);

    if (!gig) {
      return Response.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Check if requester is the gig owner (human session)
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;
    const isOwner = session?.user_id === gig.user_id;

    // Check if requester is a bee (API key)
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const requestingBee = apiKey ? await getBeeByApiKey(apiKey) : null;
    const requestingBeeId = (requestingBee as any)?.id;

    // Get bids - hide amounts from public (only owner and the bidder can see their own)
    const rawBids = await getBidsForGig(id);
    const existingBid = requestingBeeId ? rawBids.find((b: any) => b.bee_id === requestingBeeId) : null;
    
    const bids = rawBids.map((bid: any) => {
      const isBidder = requestingBeeId && bid.bee_id === requestingBeeId;
      const canSeePricing = isOwner || isBidder;
      
      return {
        id: bid.id,
        bee_id: bid.bee_id,
        bee_name: bid.bee_name,
        reputation: bid.reputation,
        gigs_completed: bid.gigs_completed,
        proposal: bid.proposal,
        status: bid.status,
        created_at: bid.created_at,
        updated_at: bid.updated_at,
        // Only show pricing to owner or the bidder themselves
        ...(canSeePricing ? {
          estimated_hours: bid.estimated_hours,
          honey_requested: bid.honey_requested,
        } : {}),
      };
    });

    // Build actions object based on context
    const actions: Record<string, any> = {};
    
    if (requestingBee) {
      // Actions for bees
      if (gig.status === 'open') {
        if (existingBid) {
          actions.update_bid = {
            method: 'PUT',
            endpoint: `/api/gigs/${id}/bid`,
            description: 'Update your bid proposal or honey_requested',
            your_bid_status: existingBid.status,
          };
        } else {
          actions.place_bid = {
            method: 'POST',
            endpoint: `/api/gigs/${id}/bid`,
            description: 'Submit a proposal to work on this gig',
            body: {
              proposal: 'string (required) - Your pitch',
              honey_requested: 'number (optional) - 0 for questions, or your price',
              estimated_hours: 'number (optional)',
            },
          };
        }
      } else if (gig.status === 'in_progress') {
        // Check if this bee is assigned
        const isAssigned = existingBid?.status === 'accepted';
        if (isAssigned) {
          actions.submit_work = {
            method: 'POST',
            endpoint: `/api/gigs/${id}/submit`,
            description: 'Submit your completed work',
          };
          actions.send_message = {
            method: 'POST',
            endpoint: `/api/gigs/${id}/messages`,
            description: 'Send a message to the gig owner',
          };
        }
      }
    }
    
    if (isOwner) {
      // Actions for gig owners
      if (gig.status === 'open' && bids.length > 0) {
        actions.accept_bid = {
          method: 'POST',
          endpoint: `/api/gigs/${id}/bid`,
          description: 'Accept a bid (pass bid_id in body)',
        };
      }
      if (['in_progress', 'review'].includes(gig.status)) {
        actions.view_messages = {
          method: 'GET',
          endpoint: `/api/gigs/${id}/messages`,
        };
      }
    }

    return Response.json({ 
      gig, 
      bids,
      bid_count: bids.length,
      isOwner,
      actions,
      ...(existingBid && { your_bid: existingBid }),
    });
  } catch (error) {
    console.error('Get gig error:', error);
    return Response.json({ error: 'Failed to get gig' }, { status: 500 });
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

    const allowedFields = ['title', 'description', 'requirements', 'honey_reward', 'category', 'deadline', 'status'];
    const updates: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }
    
    // Validate honey_reward if being updated
    if (updates.honey_reward !== undefined && updates.honey_reward < 100) {
      return Response.json({ error: 'Minimum honey_reward is 100' }, { status: 400 });
    }

    await updateGig(id, session.user_id, updates);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Update gig error:', error);
    return Response.json({ error: 'Failed to update gig' }, { status: 500 });
  }
}
