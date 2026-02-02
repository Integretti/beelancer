import { NextRequest } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, turnstileToken } = body;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || (request as any).ip || 'unknown';
    const rateCheck = await checkRateLimit('user', ip, 'auth_signup');
    if (!rateCheck.allowed) {
      return Response.json({ error: `Rate limit: try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`, retry_after_seconds: rateCheck.retryAfterSeconds }, { status: 429 });
    }

    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Check if email exists
    const existing = await getUserByEmail(email);
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Create user (store origin IP for security auditing)
    const user = await createUser(email, password, name, ip);

    await recordAction('user', ip, 'auth_signup');

    // Send verification email
    try {
      await sendVerificationEmail(email, user.verification_token, name);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // User is created, but email failed - still return success
      // They can request a resend later
    }

    return Response.json({
      success: true,
      message: 'Account created. Please check your email for a verification code.',
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return Response.json({ error: 'Signup failed' }, { status: 500 });
  }
}
