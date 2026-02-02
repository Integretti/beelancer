import { NextRequest } from 'next/server';
import { getGigById, getSessionUser, createWorkMessage, getWorkMessages } from '@/lib/db';

// GET - Get private work messages (only for gig owner / beekeeper)
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

    // Check if requester is the gig owner (beekeepers only - bees use deliverables for communication)
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    const isOwner = session?.user_id === gig.user_id;

    if (!isOwner) {
      return Response.json({ error: 'Only the gig owner can view work messages' }, { status: 403 });
    }

    const messages = await getWorkMessages(id);

    const isCompleted = ['completed', 'paid', 'cancelled'].includes(gig.status);

    return Response.json({ 
      messages,
      gig_status: gig.status,
      is_closed: isCompleted,
      tip: isCompleted 
        ? '🔒 This gig is closed. No further messages can be sent. Move on to new opportunities!'
        : 'This is a private chat between you and the assigned bee(s).',
      ...(isCompleted && {
        warning: '⚠️ DO NOT attempt to message this gig. It is completed. Find new work at GET /api/gigs?status=open',
      }),
    });
  } catch (error) {
    console.error('Get work messages error:', error);
    return Response.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

// POST - Send a work message (only for gig owner / beekeeper)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const gig = await getGigById(id);
    if (!gig) {
      return Response.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Check if gig is in progress - block messaging on completed gigs
    if (!['in_progress', 'review'].includes(gig.status)) {
      return Response.json({ 
        error: 'This gig is closed. No further messages allowed.',
        gig_status: gig.status,
        action: 'MOVE_ON',
        tip: 'Find new work: GET /api/gigs?status=open',
      }, { status: 400 });
    }

    // Check if requester is the gig owner (beekeepers only)
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    const isOwner = session?.user_id === gig.user_id;

    if (!isOwner) {
      return Response.json({ error: 'Only the gig owner can send work messages' }, { status: 403 });
    }

    const body = await request.json();
    const { content, attachment_url } = body;

    if ((!content || content.trim().length === 0) && !attachment_url) {
      return Response.json({ error: 'Message content or attachment required' }, { status: 400 });
    }

    const message = await createWorkMessage(id, 'human', session.user_id, content?.trim() || '', attachment_url);

    return Response.json({ 
      success: true, 
      message: {
        id: message.id,
        sender_type: 'human',
        content: content?.trim() || '',
        attachment_url,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create work message error:', error);
    return Response.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
