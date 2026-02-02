import { NextRequest } from 'next/server';
import { listGigs, countGigs, createGig, getSessionUser, getUserHoney } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'open';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [gigs, total] = await Promise.all([
      listGigs({ status, limit, offset }),
      countGigs({ status })
    ]);

    // Format gigs with creator info (all gigs are human-created, honey-based economy)
    const formattedGigs = (gigs as any[]).map(gig => {
      const creatorName = gig.user_name || 'Anonymous';
      const honeyReward = gig.honey_reward || 0;
      
      return {
        id: gig.id,
        title: gig.title,
        description: gig.description,
        requirements: gig.requirements,
        // Honey-based economy
        honey_reward: honeyReward,
        honey_formatted: `🍯 ${honeyReward.toLocaleString()}`,
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
        // Creator info
        creator_type: 'human',
        user_name: creatorName,
        // Detailed creator info
        creator: {
          type: 'human',
          name: creatorName,
          rating: gig.bee_rating ? Math.round(gig.bee_rating * 10) / 10 : null,
          approval_rate: Math.round((gig.approval_rate || 100) * 10) / 10,
          trust_signals: {
            has_rating: !!gig.bee_rating,
            high_approval: (gig.approval_rate || 100) >= 90,
            escrow_ready: gig.escrow_status === 'held'
          }
        },
        // Legacy client field for backwards compatibility
        client: {
          name: creatorName,
          rating: gig.bee_rating ? Math.round(gig.bee_rating * 10) / 10 : null,
          approval_rate: Math.round((gig.approval_rate || 100) * 10) / 10,
        }
      };
    });

    return Response.json({ gigs: formattedGigs, total });
  } catch (error) {
    console.error('List gigs error:', error);
    return Response.json({ error: 'Failed to list gigs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only humans can create gigs
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required. Only humans can create gigs.' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, requirements, honey_reward, category, deadline, status } = body;

    if (!title || title.length < 3) {
      return Response.json({ error: 'Title required (min 3 characters)' }, { status: 400 });
    }

    // Validate honey_reward
    const reward = parseInt(honey_reward) || 0;
    if (reward < 100) {
      return Response.json({ error: 'Minimum honey reward is 100 🍯' }, { status: 400 });
    }

    // Check user's honey balance
    const userHoney = await getUserHoney(session.user_id);
    if (userHoney < reward) {
      return Response.json({ 
        error: `Insufficient honey. You have ${userHoney} 🍯 but need ${reward} 🍯`,
        your_balance: userHoney,
        required: reward
      }, { status: 400 });
    }

    // Validate status if provided
    const validStatuses = ['draft', 'open'];
    const gigStatus = status && validStatuses.includes(status) ? status : 'open';

    const gig = await createGig(session.user_id, {
      title,
      description,
      requirements,
      honey_reward: reward,
      category,
      deadline,
      status: gigStatus,
    });

    return Response.json({ 
      success: true, 
      gig,
      message: `Gig created with ${reward} 🍯 honey reward. This will be held in escrow when a bid is accepted.`
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create gig error:', error);
    // Handle specific errors from createGig
    if (error.message?.includes('Minimum honey') || error.message?.includes('Insufficient honey')) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: 'Failed to create gig' }, { status: 500 });
  }
}
