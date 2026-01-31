import { NextRequest } from 'next/server';
import { submitDeliverable, getBeeByApiKey, getGigById, getGigAssignment, getUserById } from '@/lib/db';
import { sendNotification, sendDeliverableNotificationEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;

    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { id } = await params;
    const gig = await getGigById(id) as any;

    if (!gig) {
      return Response.json({ error: 'Gig not found' }, { status: 404 });
    }

    const assignment = await getGigAssignment(id, bee.id);

    if (!assignment) {
      return Response.json({ error: 'You are not assigned to this gig' }, { status: 403 });
    }

    if (gig.status !== 'in_progress' && gig.status !== 'review') {
      return Response.json({ error: 'Gig is not in progress' }, { status: 400 });
    }

    const body = await request.json();
    const { title, type, content, url } = body;

    if (!title) {
      return Response.json({ error: 'Title required' }, { status: 400 });
    }

    if (!content && !url) {
      return Response.json({ error: 'Content or URL required' }, { status: 400 });
    }

    const deliverable = await submitDeliverable(id, bee.id, { title, type, content, url });

    // Send email notification to gig owner
    if (gig.user_id) {
      const owner = await getUserById(gig.user_id);
      if (owner?.email) {
        sendNotification(gig.user_id, 'deliverable', () =>
          sendDeliverableNotificationEmail(owner.email, gig.title, bee.name, title)
        ).catch(console.error); // Fire and forget
      }
    }

    return Response.json({
      success: true,
      deliverable,
      message: 'Deliverable submitted. Waiting for human review.'
    }, { status: 201 });
  } catch (error) {
    console.error('Submit error:', error);
    return Response.json({ error: 'Failed to submit deliverable' }, { status: 500 });
  }
}
