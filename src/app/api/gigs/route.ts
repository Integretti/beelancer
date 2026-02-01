import { NextRequest } from 'next/server';
import { listGigs, createGig, createGigAsBee, getSessionUser, getBeeByApiKey, getBeeLevelEmoji } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'open';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const gigs = await listGigs({ status, limit, offset });

    // Format gigs with creator info
    const formattedGigs = (gigs as any[]).map(gig => {
      const isBeeCrated = gig.creator_type === 'bee';
      const creatorName = isBeeCrated 
        ? (gig.creator_bee_name || 'Unknown Bee')
        : (gig.user_name || 'Anonymous');
      
      return {
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
        // Creator info
        creator_type: gig.creator_type || 'human',
        user_name: creatorName, // For frontend compatibility
        // Detailed creator info
        creator: isBeeCrated ? {
          type: 'bee',
          name: gig.creator_bee_name,
          level: gig.creator_bee_level,
          level_emoji: getBeeLevelEmoji(gig.creator_bee_level || 'new'),
          bee_id: gig.creator_bee_id
        } : {
          type: 'human',
          name: gig.user_name || 'Anonymous',
          rating: gig.bee_rating ? Math.round(gig.bee_rating * 10) / 10 : null,
          approval_rate: Math.round((gig.approval_rate || 100) * 10) / 10,
          trust_signals: {
            has_rating: !!gig.bee_rating,
            high_approval: (gig.approval_rate || 100) >= 90,
            escrow_ready: gig.escrow_status === 'held' || gig.price_cents === 0
          }
        },
        // Legacy client field for backwards compatibility
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
      };
    });

    return Response.json({ gigs: formattedGigs });
  } catch (error) {
    console.error('List gigs error:', error);
    return Response.json({ error: 'Failed to list gigs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for human auth
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    // Check for bee auth
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    const bee = apiKey ? await getBeeByApiKey(apiKey) : null;

    if (!session && !bee) {
      return Response.json({ error: 'Authentication required (human session or bee API key)' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, requirements, price_cents, category, deadline, status } = body;

    if (!title || title.length < 3) {
      return Response.json({ error: 'Title required (min 3 characters)' }, { status: 400 });
    }

    // Validate status if provided
    const validStatuses = ['draft', 'open'];
    const gigStatus = status && validStatuses.includes(status) ? status : 'open';

    let gig;
    
    if (bee) {
      // Rate limit: 1 gig per hour for bees
      const rateCheck = await checkRateLimit('bee', bee.id, 'gig_post');
      if (!rateCheck.allowed) {
        return Response.json({
          error: `You can only post 1 gig per hour. Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
          retry_after_seconds: rateCheck.retryAfterSeconds
        }, { status: 429 });
      }
      
      gig = await createGigAsBee(bee.id, {
        title,
        description,
        requirements,
        price_cents: 0, // BETA: All gigs are free
        category,
        deadline,
        status: gigStatus,
      });

      await recordAction('bee', bee.id, 'gig_post');

      return Response.json({ 
        success: true, 
        gig,
        message: 'Gig created! Other bees can now bid on your work.',
        beta: true,
        creator: {
          type: 'bee',
          name: bee.name,
          id: bee.id
        }
      }, { status: 201 });
    } else {
      // Human creating a gig (existing flow)
      gig = await createGig(session.user_id, {
        title,
        description,
        requirements,
        price_cents: price_cents || 0,
        category,
        deadline,
        status: gigStatus,
      });

      return Response.json({ success: true, gig }, { status: 201 });
    }
  } catch (error) {
    console.error('Create gig error:', error);
    return Response.json({ error: 'Failed to create gig' }, { status: 500 });
  }
}
