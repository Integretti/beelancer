import { NextRequest } from 'next/server';
import { 
  getSessionUser, 
  getBeeByApiKey,
  getGigById,
  openDispute,
  getDisputeByGig,
  addDisputeMessage,
  getDisputeMessages,
  resolveDispute
} from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

// Open a dispute or add a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reason, evidence, message, action } = body;

    // Check for human auth
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    // Check for bee auth
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    const bee = apiKey ? await getBeeByApiKey(apiKey) : null;

    if (!session && !bee) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const gig = await getGigById(id) as any;
    if (!gig) {
      return Response.json({ error: 'Gig not found' }, { status: 404 });
    }

    // Check authorization
    const isGigOwner = session && gig.user_id === session.user_id;
    // For bee, we'd need to check if they're assigned - simplified for now
    const isBeeOnGig = bee !== null;

    if (!isGigOwner && !isBeeOnGig) {
      return Response.json({ error: 'Not authorized to dispute this gig' }, { status: 403 });
    }

    // Add message to existing dispute
    if (action === 'add_message') {
      const dispute = await getDisputeByGig(id);
      if (!dispute) {
        return Response.json({ error: 'No dispute found for this gig' }, { status: 404 });
      }

      if (!message) {
        return Response.json({ error: 'Message content required' }, { status: 400 });
      }

      const senderType = session ? 'human' : 'bee';
      const senderId = session ? session.user_id : bee.id;

      const result = await addDisputeMessage(dispute.id, senderType, senderId, message);
      return Response.json({ success: true, message_id: result.id });
    }

    // Open new dispute
    if (!reason) {
      return Response.json({ error: 'Reason required to open dispute' }, { status: 400 });
    }

    // Rate limit: 1 dispute per 5 minutes
    const entityType = session ? 'user' : 'bee';
    const entityId = session ? session.user_id : bee.id;
    const rateCheck = await checkRateLimit(entityType, entityId, 'dispute');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Slow down! Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds
      }, { status: 429 });
    }

    // Check if dispute already exists
    const existingDispute = await getDisputeByGig(id);
    if (existingDispute && existingDispute.status === 'open') {
      return Response.json({ 
        error: 'Dispute already open for this gig',
        dispute_id: existingDispute.id
      }, { status: 400 });
    }

    const openedByType = session ? 'human' : 'bee';
    const openedById = session ? session.user_id : bee.id;

    const result = await openDispute(id, openedByType, openedById, reason, evidence);

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    await recordAction(entityType, entityId, 'dispute');

    return Response.json({
      success: true,
      message: 'Dispute opened. Both parties can now submit evidence.',
      dispute_id: result.dispute_id
    });

  } catch (error) {
    console.error('Dispute error:', error);
    return Response.json({ error: 'Failed to process dispute' }, { status: 500 });
  }
}

// Get dispute details and messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check for human auth
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    // Check for bee auth
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '');
    const bee = apiKey ? await getBeeByApiKey(apiKey) : null;

    if (!session && !bee) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const dispute = await getDisputeByGig(id);
    if (!dispute) {
      return Response.json({ error: 'No dispute found for this gig' }, { status: 404 });
    }

    const messages = await getDisputeMessages(dispute.id);

    return Response.json({
      dispute: {
        id: dispute.id,
        gig_id: dispute.gig_id,
        status: dispute.status,
        reason: dispute.reason,
        opened_by_type: dispute.opened_by_type,
        resolution: dispute.resolution,
        resolution_note: dispute.resolution_note,
        escrow_decision: dispute.escrow_decision,
        created_at: dispute.created_at,
        decided_at: dispute.decided_at
      },
      messages
    });

  } catch (error) {
    console.error('Get dispute error:', error);
    return Response.json({ error: 'Failed to get dispute' }, { status: 500 });
  }
}
