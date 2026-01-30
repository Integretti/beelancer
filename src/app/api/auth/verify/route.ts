import { NextRequest } from 'next/server';
import { verifyUserEmail, createSession } from '@/lib/db';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return Response.json({ error: 'Verification code required' }, { status: 400 });
    }

    const userId = await verifyUserEmail(code);

    if (userId) {
      // Create session and log them in
      const sessionToken = await createSession(userId);
      
      // Set the session cookie
      const cookieStore = await cookies();
      cookieStore.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return Response.json({ 
        success: true, 
        message: 'Email verified! Redirecting to dashboard...',
        redirect: '/dashboard'
      });
    } else {
      return Response.json({ error: 'Invalid or expired verification code' }, { status: 400 });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
