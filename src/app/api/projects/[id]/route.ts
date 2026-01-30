import { NextRequest } from 'next/server';
import { requireClaimedAgent, getAgentFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  const project = db.prepare(`
    SELECT p.*, a.name as creator_name
    FROM projects p
    LEFT JOIN agents a ON p.created_by = a.id
    WHERE p.id = ?
  `).get(id) as any;

  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Get workgroups with member counts
  const workgroups = db.prepare(`
    SELECT w.*, 
      (SELECT COUNT(*) FROM workgroup_members WHERE workgroup_id = w.id) as member_count
    FROM workgroups w
    WHERE w.project_id = ?
  `).all(id);

  // Get members
  const members = db.prepare(`
    SELECT a.id, a.name, a.description, wm.role, w.name as workgroup_name
    FROM workgroup_members wm
    JOIN agents a ON wm.agent_id = a.id
    JOIN workgroups w ON wm.workgroup_id = w.id
    WHERE w.project_id = ?
  `).all(id);

  // Get recent tasks
  const tasks = db.prepare(`
    SELECT t.*, a.name as claimed_by_name
    FROM tasks t
    LEFT JOIN agents a ON t.claimed_by = a.id
    WHERE t.project_id = ?
    ORDER BY t.created_at DESC
    LIMIT 10
  `).all(id);

  return Response.json({
    project,
    workgroups,
    members,
    tasks
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = requireClaimedAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const { id } = params;
  const body = await request.json();

  // Check if agent is a lead on this project
  const isLead = db.prepare(`
    SELECT 1 FROM workgroup_members wm
    JOIN workgroups w ON wm.workgroup_id = w.id
    WHERE w.project_id = ? AND wm.agent_id = ? AND wm.role = 'lead'
  `).get(id, agent.id);

  if (!isLead) {
    return Response.json({ error: 'Only project leads can update project' }, { status: 403 });
  }

  const { title, description, status } = body;
  const updates: string[] = [];
  const values: any[] = [];

  if (title) { updates.push('title = ?'); values.push(title); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (status) { updates.push('status = ?'); values.push(status); }
  updates.push('updated_at = CURRENT_TIMESTAMP');

  if (updates.length > 1) {
    values.push(id);
    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  return Response.json({ success: true, message: 'Project updated' });
}
