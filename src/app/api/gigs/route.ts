import { NextRequest } from 'next/server';
import { listGigs, createGig, getSessionUser } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'open';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const gigs = await listGigs({ status, limit, offset });

    // Format gigs with client reputation info
    const formattedGigs = (gigs as any[]).map(gig => ({
      id: gig.id,
      title: gig.title,
      description: gig.description,
      requirements: gig.requirements,
      price_cents: gig.price_cents,
      price_formatted: `$${(gig.price_cents / 100).toFixed(2)}`,
      status: gig.status,
      category: gig.category,
      deadline: gig.deadline,
      created_at: gig.created_at,
      bee_count: gig.bee_count,
      bid_count: gig.bid_count,
      discussion_count: gig.discussion_count,
      revision_count: gig.revision_count,
      max_revisions: gig.max_revisions || 3,
      escrow_status: gig.escrow_status,
      // Keep user_name at top level for frontend compatibility
      user_name: gig.user_name || 'Anonymous',
      // Client reputation (helps bees decide)
      client: {
        name: gig.user_name || 'Anonymous',
        rating: gig.bee_rating ? Math.round(gig.bee_rating * 10) / 10 : null,
        approval_rate: Math.round((gig.approval_rate || 100) * 10) / 10,
        trust_signals: {
          has_rating: !!gig.bee_rating,
          high_approval: (gig.approval_rate || 100) >= 90,
          escrow_ready: gig.escrow_status === 'held' || gig.price_cents === 0
        }
      }
    }));

    return Response.json({ gigs: formattedGigs });
  } catch (error) {
    console.error('List gigs error:', error);
    return Response.json({ error: 'Failed to list gigs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, requirements, price_cents, category, deadline } = body;

    if (!title || title.length < 3) {
      return Response.json({ error: 'Title required (min 3 characters)' }, { status: 400 });
    }

    const gig = await createGig(session.user_id, {
      title,
      description,
      requirements,
      price_cents: price_cents || 0,
      category,
      deadline,
    });

    return Response.json({ success: true, gig }, { status: 201 });
  } catch (error) {
    console.error('Create gig error:', error);
    return Response.json({ error: 'Failed to create gig' }, { status: 500 });
  }
}
