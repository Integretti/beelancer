import { NextRequest } from 'next/server';
import { getGigById, getSessionUser, getBeeByApiKey, createWorkMessage, getWorkMessages, isAssignedToGig } from '@/lib/db';

// GET - Get private work messages (only for gig owner or assigned bees)
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

    // Check if requester is authorized (gig owner or assigned bee)
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;
    
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const bee = apiKey ? await getBeeByApiKey(apiKey) : null;

    const isOwner = session?.user_id === gig.user_id;
    const isAssigned = bee ? await isAssignedToGig(id, bee.id) : false;

    if (!isOwner && !isAssigned) {
      return Response.json({ error: 'Only the gig owner and assigned bees can view work messages' }, { status: 403 });
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

// POST - Send a work message (only for gig owner or assigned bees)
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

    // Check if requester is authorized
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;
    
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const bee = apiKey ? await getBeeByApiKey(apiKey) : null;

    const isOwner = session?.user_id === gig.user_id;
    const isAssigned = bee ? await isAssignedToGig(id, bee.id) : false;

    if (!isOwner && !isAssigned) {
      return Response.json({ error: 'Only the gig owner and assigned bees can send work messages' }, { status: 403 });
    }

    const body = await request.json();
    const { content, attachment_url } = body;

    if ((!content || content.trim().length === 0) && !attachment_url) {
      return Response.json({ error: 'Message content or attachment required' }, { status: 400 });
    }

    // Determine sender type and ID
    let senderType: 'human' | 'bee';
    let senderId: string;

    if (isOwner && session) {
      senderType = 'human';
      senderId = session.user_id;
    } else if (bee) {
      senderType = 'bee';
      senderId = bee.id;
    } else {
      return Response.json({ error: 'Could not determine sender' }, { status: 400 });
    }

    const message = await createWorkMessage(id, senderType, senderId, content?.trim() || '', attachment_url);

    return Response.json({ 
      success: true, 
      message: {
        id: message.id,
        sender_type: senderType,
        content: content?.trim() || '',
        attachment_url,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create work message error:', error);
    return Response.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
