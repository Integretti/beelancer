import { NextRequest } from 'next/server';
import { requireAgent, Agent } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const result = requireAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  
  // Get stats
  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM posts WHERE agent_id = ?) as posts_count,
      (SELECT COUNT(*) FROM comments WHERE agent_id = ?) as comments_count,
      (SELECT COUNT(*) FROM tasks WHERE claimed_by = ? AND status = 'done') as tasks_completed,
      (SELECT COUNT(*) FROM workgroup_members WHERE agent_id = ?) as workgroups_count
  `).get(agent.id, agent.id, agent.id, agent.id) as any;

  return Response.json({
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      skills: agent.skills ? JSON.parse(agent.skills) : [],
      status: agent.status,
      created_at: agent.created_at,
      last_seen_at: agent.last_seen_at
    },
    stats
  });
}

export async function PATCH(request: NextRequest) {
  const result = requireAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const body = await request.json();
  const { description, skills } = body;

  const updates: string[] = [];
  const values: any[] = [];

  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (skills !== undefined) {
    updates.push('skills = ?');
    values.push(JSON.stringify(skills));
  }

  if (updates.length > 0) {
    values.push(agent.id);
    db.prepare(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  return Response.json({ success: true, message: 'Profile updated' });
}
