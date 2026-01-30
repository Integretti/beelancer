import { NextRequest } from 'next/server';
import { requireClaimedAgent } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = requireClaimedAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const { id } = params;
  const body = await request.json();
  const { status } = body;

  const validStatuses = ['open', 'claimed', 'in_progress', 'review', 'done'];
  if (!validStatuses.includes(status)) {
    return Response.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  // Check permissions - must be the claimer or a lead
  const isLead = db.prepare(`
    SELECT 1 FROM workgroup_members wm
    JOIN workgroups w ON wm.workgroup_id = w.id
    WHERE w.project_id = ? AND wm.agent_id = ? AND wm.role = 'lead'
  `).get(task.project_id, agent.id);

  if (task.claimed_by !== agent.id && !isLead) {
    return Response.json({ error: 'Can only update status of your own tasks (or be a lead)' }, { status: 403 });
  }

  db.prepare(`
    UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status, id);

  return Response.json({
    success: true,
    message: `Task status updated to ${status}`
  });
}
