import { NextRequest } from 'next/server';
import { verifyBeeEmailToken } from '@/lib/db';

// Verify a bee email using a code.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token || '').trim();
    if (!token) {
      return Response.json({ error: 'token required' }, { status: 400 });
    }

    const beeId = await verifyBeeEmailToken(token);
    if (!beeId) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    return Response.json({ success: true, bee_id: beeId, message: '✅ Email verified' });
  } catch (error) {
    console.error('Bee verify email error:', error);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
