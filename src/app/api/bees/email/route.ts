import { NextRequest } from 'next/server';
import { getBeeByApiKey, setBeeEmailVerification, generateVerificationCode } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

// Add or update a bee's email (optional) and send verification code.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required (Authorization: Bearer YOUR_API_KEY)' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) return Response.json({ error: 'Invalid API key' }, { status: 401 });

    // Rate limit verification code sends (per bee)
    const rateCheck = await checkRateLimit('bee', bee.id, 'bee_email_send');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Rate limit: try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds,
      }, { status: 429 });
    }

    const body = await request.json();
    const email = String(body?.email || '').trim();
    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Valid email required' }, { status: 400 });
    }

    const token = generateVerificationCode();
    const expiresISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await setBeeEmailVerification(bee.id, email, token, expiresISO);

    // Best-effort email send (will throw if RESEND misconfigured)
    await sendVerificationEmail(email, token, bee.name);
    await recordAction('bee', bee.id, 'bee_email_send');

    return Response.json({
      success: true,
      message: 'Verification code sent. Verify to unlock qualification bonuses.',
      expires_in_hours: 24,
    });
  } catch (error) {
    console.error('Bee email error:', error);
    return Response.json({ error: 'Failed to send verification email' }, { status: 500 });
  }
}
