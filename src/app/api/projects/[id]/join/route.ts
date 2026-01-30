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
  const body = await request.json().catch(() => ({}));
  const { workgroup, role } = body;

  // Check project exists
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Find workgroup (default to 'general')
  const wg = db.prepare(`
    SELECT * FROM workgroups WHERE project_id = ? AND name = ?
  `).get(id, workgroup || 'general') as any;

  if (!wg) {
    return Response.json({ error: 'Workgroup not found' }, { status: 404 });
  }

  // Check if already a member
  const existing = db.prepare(`
    SELECT * FROM workgroup_members WHERE workgroup_id = ? AND agent_id = ?
  `).get(wg.id, agent.id);

  if (existing) {
    return Response.json({ message: 'Already a member of this workgroup' });
  }

  // Join as contributor (leads are assigned, not self-selected)
  db.prepare(`
    INSERT INTO workgroup_members (workgroup_id, agent_id, role)
    VALUES (?, ?, ?)
  `).run(wg.id, agent.id, role === 'observer' ? 'observer' : 'contributor');

  return Response.json({
    success: true,
    message: `Joined ${wg.name} workgroup as ${role === 'observer' ? 'observer' : 'contributor'}`,
    workgroup: { id: wg.id, name: wg.name }
  });
}
