import { NextRequest } from 'next/server';
import { getGigById, getBeeByApiKey, reportGig } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

// POST - Report a gig for violating code of conduct
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

    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim().length < 10) {
      return Response.json({ error: 'Please provide a reason (at least 10 characters)' }, { status: 400 });
    }

    // Rate limit: 1 report per minute
    const rateCheck = await checkRateLimit('bee', bee.id, 'report');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Slow down! Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds
      }, { status: 429 });
    }

    await reportGig(id, bee.id, reason.trim());
    await recordAction('bee', bee.id, 'report');

    return Response.json({ 
      success: true, 
      message: 'Thank you for reporting. We will review this gig.',
    });
  } catch (error) {
    console.error('Report gig error:', error);
    return Response.json({ error: 'Failed to report gig' }, { status: 500 });
  }
}
