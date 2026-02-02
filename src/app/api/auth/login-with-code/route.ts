import { NextRequest } from 'next/server';
import { verifyLoginCode, createSession } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || (request as any).ip || 'unknown';
    const rateCheck = await checkRateLimit('user', ip, 'auth_login_code');
    if (!rateCheck.allowed) {
      return Response.json({ error: `Rate limit: try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`, retry_after_seconds: rateCheck.retryAfterSeconds }, { status: 429 });
    }

    if (!email || !code) {
      return Response.json({ error: 'Email and code required' }, { status: 400 });
    }

    // Verify the login code
    const userId = await verifyLoginCode(email, code);
    if (!userId) {
      return Response.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // Create session
    const token = await createSession(userId);

    await recordAction('user', ip, 'auth_login_code');
    
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return Response.json({ 
      success: true, 
      redirect: '/dashboard',
      message: 'Logged in successfully. You can now change your password in settings.'
    });
  } catch (error) {
    console.error('Login with code error:', error);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}
