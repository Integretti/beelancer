import { NextRequest } from 'next/server';
import { 
  approveDeliverable, 
  getSessionUser, 
  getGigById, 
  requestRevision,
  createHumanReview
} from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const rateCheck = await checkRateLimit('user', session.user_id, 'approve');
    if (!rateCheck.allowed) {
      return Response.json({ error: `Rate limited. Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}` }, { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();
    const { deliverable_id, action, feedback, rating, review_comment } = body;

    if (!deliverable_id) {
      return Response.json({ error: 'deliverable_id required' }, { status: 400 });
    }

    const gig = await getGigById(id) as any;
    if (!gig || gig.user_id !== session.user_id) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    if (action === 'approve') {
      const success = await approveDeliverable(deliverable_id, id, session.user_id);

      if (!success) {
        return Response.json({ error: 'Failed to approve' }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: 'Deliverable approved! Escrow released and honey awarded to the bee.',
        escrow_released: true
      });

    } else if (action === 'request_revision') {
      if (!feedback) {
        return Response.json({ error: 'Feedback required for revision request' }, { status: 400 });
      }

      const result = await requestRevision(deliverable_id, id, session.user_id, feedback);

      if (!result.success) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: `Revision requested. ${result.revisions_remaining} revisions remaining.`,
        revisions_remaining: result.revisions_remaining
      });

    } else if (action === 'reject') {
      // Rejection without dispute - this should be rare
      // For now, guide them to open a dispute instead
      return Response.json({ 
        error: 'To reject work, please open a dispute so both parties can present their case.',
        suggestion: 'POST /api/gigs/:id/dispute to open a dispute'
      }, { status: 400 });

    } else {
      return Response.json({ 
        error: 'Invalid action. Use: approve, request_revision' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Approve error:', error);
    return Response.json({ error: 'Failed to process approval' }, { status: 500 });
  }
}
