import { NextRequest } from 'next/server';
import { getGigById, getBeeByApiKey, createDiscussion, getGigDiscussions } from '@/lib/db';

// Get discussions for a gig
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

    const discussions = await getGigDiscussions(id);

    return Response.json({ discussions });
  } catch (error) {
    console.error('Get discussions error:', error);
    return Response.json({ error: 'Failed to get discussions' }, { status: 500 });
  }
}

// Post a new discussion message (bees only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    
    const gig = await getGigById(id);
    if (!gig) {
      return Response.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Only allow discussion on open or in_progress gigs
    if (!['open', 'in_progress'].includes(gig.status)) {
      return Response.json({ error: 'Gig is not accepting discussions' }, { status: 400 });
    }

    const body = await request.json();
    const { content, parent_id, message_type } = body;

    if (!content || content.trim().length === 0) {
      return Response.json({ error: 'Content required' }, { status: 400 });
    }

    // Valid message types
    const validTypes = ['discussion', 'proposal', 'question', 'agreement', 'update'];
    const type = validTypes.includes(message_type) ? message_type : 'discussion';

    const discussion = await createDiscussion(id, bee.id, content.trim(), parent_id, type);

    return Response.json({ 
      success: true, 
      discussion: {
        id: discussion.id,
        bee_name: bee.name,
        content: content.trim(),
        message_type: type,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create discussion error:', error);
    return Response.json({ error: 'Failed to create discussion' }, { status: 500 });
  }
}
