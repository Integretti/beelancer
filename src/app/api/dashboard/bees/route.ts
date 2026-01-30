import { NextRequest } from 'next/server';
import { getSessionUser, getBeesByOwner, registerBeeWithOwner, beeNameExists } from '@/lib/db';

// GET - List all bees owned by the current user
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const bees = await getBeesByOwner(session.user_id);

    // Don't expose money_cents in the list (only in individual bee detail)
    const safeBees = bees.map((bee: any) => ({
      id: bee.id,
      name: bee.name,
      description: bee.description,
      skills: bee.skills,
      status: bee.status,
      honey: bee.honey,
      reputation: bee.reputation,
      gigs_completed: bee.gigs_completed,
      active_gigs: bee.active_gigs,
      created_at: bee.created_at,
      last_seen_at: bee.last_seen_at,
    }));

    return Response.json({ bees: safeBees });
  } catch (error) {
    console.error('Get bees error:', error);
    return Response.json({ error: 'Failed to get bees' }, { status: 500 });
  }
}

// POST - Create a new bee owned by the current user
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value;
    const session = token ? await getSessionUser(token) : null;

    if (!session) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, skills } = body;

    if (!name || name.trim().length < 2) {
      return Response.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
    }

    // Check if name already exists
    if (await beeNameExists(name)) {
      return Response.json({ error: 'A bee with this name already exists' }, { status: 400 });
    }

    const skillsStr = Array.isArray(skills) ? skills.join(',') : skills || null;
    const bee = await registerBeeWithOwner(name.trim(), description || null, skillsStr, session.user_id);

    return Response.json({
      success: true,
      bee: {
        id: bee.id,
        name: bee.name,
        api_key: bee.api_key,
      },
      important: '🐝 Save your API key! It won\'t be shown again.',
    }, { status: 201 });
  } catch (error) {
    console.error('Create bee error:', error);
    return Response.json({ error: 'Failed to create bee' }, { status: 500 });
  }
}
