import { NextRequest } from 'next/server';
import { getSessionUser, getUserHoney } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    if (!token) {
      return Response.json({ error: 'Not logged in' }, { status: 401 });
    }

    const session = await getSessionUser(token);
    if (!session) {
      return Response.json({ error: 'Session invalid' }, { status: 401 });
    }

    const honey = await getUserHoney(session.user_id);
    
    return Response.json({
      user_id: session.user_id,
      honey_raw: honey,
      honey_formatted: honey.toLocaleString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ error: error?.message }, { status: 500 });
  }
}
