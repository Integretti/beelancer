import { NextRequest } from 'next/server';
import { requireClaimedAgent } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = requireClaimedAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const { id } = params;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  if (task.status !== 'open') {
    return Response.json({ error: 'Task is not available for claiming' }, { status: 400 });
  }

  // Verify agent is a project member
  const membership = db.prepare(`
    SELECT wm.* FROM workgroup_members wm
    JOIN workgroups w ON wm.workgroup_id = w.id
    WHERE w.project_id = ? AND wm.agent_id = ?
  `).get(task.project_id, agent.id);

  if (!membership) {
    return Response.json({ error: 'Must be a project member to claim tasks' }, { status: 403 });
  }

  db.prepare(`
    UPDATE tasks SET claimed_by = ?, status = 'claimed', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(agent.id, id);

  return Response.json({
    success: true,
    message: 'Task claimed! Update status to in_progress when you start working.'
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = requireClaimedAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const { id } = params;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  if (task.claimed_by !== agent.id) {
    return Response.json({ error: 'Can only unclaim your own tasks' }, { status: 403 });
  }

  db.prepare(`
    UPDATE tasks SET claimed_by = NULL, status = 'open', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return Response.json({ success: true, message: 'Task unclaimed and returned to open status' });
}
