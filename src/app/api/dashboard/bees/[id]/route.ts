import { NextRequest } from 'next/server';
import { getSessionUser, getBeeWithPrivateData, getBeeCurrentWork, getBeeRecentActivity, updateBee, unregisterBee, reactivateBee, beeNameExists } from '@/lib/db';

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
        recovery_email: bee.recovery_email,
        honey: bee.honey,
        money_cents: bee.money_cents,
        reputation: bee.reputation,
        gigs_completed: bee.gigs_completed,
        active_gigs: bee.active_gigs,
        created_at: bee.created_at,
        last_seen_at: bee.last_seen_at,
        unregistered_at: bee.unregistered_at,
      },
      currentWork,
      recentActivity,
    });
  } catch (error) {
    console.error('Get bee detail error:', error);
    return Response.json({ error: 'Failed to get bee details' }, { status: 500 });
  }
}

// PATCH - Update bee details
export async function PATCH(
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
    const body = await request.json();

    // Verify ownership
    const bee = await getBeeWithPrivateData(id, session.user_id);
    if (!bee) {
      return Response.json({ error: 'Bee not found or you don\'t have access' }, { status: 404 });
    }

    const updates: any = {};

    // Validate and collect updates
    if (body.name !== undefined) {
      if (body.name.trim().length < 2) {
        return Response.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
      }
      // Check if new name is taken (unless it's the same)
      if (body.name.toLowerCase() !== bee.name.toLowerCase()) {
        if (await beeNameExists(body.name)) {
          return Response.json({ error: 'A bee with this name already exists' }, { status: 400 });
        }
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description || null;
    }

    if (body.skills !== undefined) {
      updates.skills = Array.isArray(body.skills) ? body.skills.join(',') : body.skills || null;
    }

    if (body.recovery_email !== undefined) {
      updates.recovery_email = body.recovery_email || null;
    }

    await updateBee(id, session.user_id, updates);

    return Response.json({ success: true, message: 'Bee updated' });
  } catch (error) {
    console.error('Update bee error:', error);
    return Response.json({ error: 'Failed to update bee' }, { status: 500 });
  }
}

// DELETE - Unregister bee (soft delete)
export async function DELETE(
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

    // Verify ownership
    const bee = await getBeeWithPrivateData(id, session.user_id);
    if (!bee) {
      return Response.json({ error: 'Bee not found or you don\'t have access' }, { status: 404 });
    }

    await unregisterBee(id, session.user_id);

    return Response.json({ 
      success: true, 
      message: `${bee.name} has been unregistered. All records are preserved.` 
    });
  } catch (error) {
    console.error('Unregister bee error:', error);
    return Response.json({ error: 'Failed to unregister bee' }, { status: 500 });
  }
}

// POST - Reactivate a previously unregistered bee
export async function POST(
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
    const body = await request.json();

    if (body.action !== 'reactivate') {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Verify ownership
    const bee = await getBeeWithPrivateData(id, session.user_id);
    if (!bee) {
      return Response.json({ error: 'Bee not found or you don\'t have access' }, { status: 404 });
    }

    await reactivateBee(id, session.user_id);

    return Response.json({ 
      success: true, 
      message: `${bee.name} has been reactivated!` 
    });
  } catch (error) {
    console.error('Reactivate bee error:', error);
    return Response.json({ error: 'Failed to reactivate bee' }, { status: 500 });
  }
}
