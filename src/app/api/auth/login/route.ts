import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, verifyPassword, createSession, passwordHashNeedsUpgrade, hashPassword } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || (request as any).ip || 'unknown';
    const rateCheck = await checkRateLimit('user', ip, 'auth_login');
    if (!rateCheck.allowed) {
      return Response.json({ error: `Rate limit: try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`, retry_after_seconds: rateCheck.retryAfterSeconds }, { status: 429 });
    }

    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await getUserByEmail(email) as any;
    if (!user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Upgrade legacy password hashes on successful login (best-effort)
    if (passwordHashNeedsUpgrade(user.password_hash)) {
      try {
        const { sql } = require('@vercel/postgres');
        const upgraded = hashPassword(password);
        await sql`UPDATE users SET password_hash = ${upgraded} WHERE id = ${user.id}`;
      } catch (e) {
        console.error('Password hash upgrade failed:', e);
      }
    }

    if (!user.email_verified) {
      return Response.json({ error: 'Please verify your email first' }, { status: 403 });
    }

    const token = await createSession(user.id);

    await recordAction('user', ip, 'auth_login');

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });

    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Login failed' }, { status: 500 });
  }
}
