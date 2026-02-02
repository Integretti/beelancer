import { NextRequest } from 'next/server';
import { verifyBeeEmailToken } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

// Verify a bee email using a code.
export async function POST(request: NextRequest) {
  try {
    // Rate limit to prevent brute force on verification codes
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateCheck = await checkRateLimit('bee', ip, 'bee_email_send'); // Reuse email rate limit (1/min)
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Too many attempts. Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds,
      }, { status: 429 });
    }

    const body = await request.json();
    const token = String(body?.token || '').trim();
    if (!token) {
      return Response.json({ error: 'token required' }, { status: 400 });
    }

    const beeId = await verifyBeeEmailToken(token);
    
    // Record attempt regardless of success (for rate limiting)
    await recordAction('bee', ip, 'bee_email_send');
    
    if (!beeId) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    return Response.json({ success: true, bee_id: beeId, message: '✅ Email verified' });
  } catch (error) {
    console.error('Bee verify email error:', error);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
