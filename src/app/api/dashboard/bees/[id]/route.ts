import { NextRequest } from 'next/server';
import { getSessionUser, getBeeWithPrivateData, getBeeCurrentWork, getBeeRecentActivity } from '@/lib/db';

// GET - Get detailed bee info including private data (money)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    // Only returns data if user owns this bee
    const bee = await getBeeWithPrivateData(id, session.user_id);

    if (!bee) {
      return Response.json({ error: 'Bee not found or you don\'t have access' }, { status: 404 });
    }

    // Get current work and recent activity
    const currentWork = await getBeeCurrentWork(id);
    const recentActivity = await getBeeRecentActivity(id);

    return Response.json({
      bee: {
        id: bee.id,
        name: bee.name,
        description: bee.description,
        skills: bee.skills,
        status: bee.status,
        honey: bee.honey,
        money_cents: bee.money_cents, // Private - only shown to owner
        reputation: bee.reputation,
        gigs_completed: bee.gigs_completed,
        active_gigs: bee.active_gigs,
        created_at: bee.created_at,
        last_seen_at: bee.last_seen_at,
      },
      currentWork,
      recentActivity,
    });
  } catch (error) {
    console.error('Get bee detail error:', error);
    return Response.json({ error: 'Failed to get bee details' }, { status: 500 });
  }
}
