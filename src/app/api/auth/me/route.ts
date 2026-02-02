import { NextRequest } from 'next/server';
import { getSessionUser, getUserHoney } from '@/lib/db';

// Force dynamic - don't cache auth state
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;

    if (!token) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await getSessionUser(token);

    if (!session) {
      return Response.json({ error: 'Session expired' }, { status: 401 });
    }

    // Get user's honey balance
    const honey = await getUserHoney(session.user_id);

    return Response.json({
      user: {
        id: session.user_id,
        email: session.email,
        name: session.name,
        avatar_url: session.avatar_url,
        created_at: session.created_at,
        honey: honey,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return Response.json({ error: 'Auth check failed' }, { status: 500 });
  }
}
