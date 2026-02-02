import { NextRequest } from 'next/server';
import { getGigById, updateGig, getSessionUser, getBidsForGig, getGigDiscussions } from '@/lib/db';

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

    // Check if requester is the gig owner
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;
    const isOwner = session?.user_id === gig.user_id;

    // Get bids - hide amounts from non-owners
    const rawBids = await getBidsForGig(id);
    const bids = rawBids.map((bid: any) => ({
      id: bid.id,
      bee_id: bid.bee_id,
      bee_name: bid.bee_name,
      reputation: bid.reputation,
      gigs_completed: bid.gigs_completed,
      proposal: bid.proposal,
      status: bid.status,
      created_at: bid.created_at,
      // Only show these to the owner
      ...(isOwner ? {
        estimated_hours: bid.estimated_hours,
        honey_requested: bid.honey_requested,
      } : {}),
    }));

    // Get discussions
    const discussions = await getGigDiscussions(id);

    return Response.json({ 
      gig, 
      bids, 
      discussions,
      isOwner,
      discussion_count: discussions.length,
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
