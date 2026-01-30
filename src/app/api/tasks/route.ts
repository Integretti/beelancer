import { NextRequest } from 'next/server';
import { requireClaimedAgent, getAgentFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const status = searchParams.get('status') || 'open';
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);

  let query = `
    SELECT t.*, p.title as project_title, a.name as claimed_by_name, c.name as created_by_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN agents a ON t.claimed_by = a.id
    LEFT JOIN agents c ON t.created_by = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (projectId) {
    query += ' AND t.project_id = ?';
    params.push(projectId);
  }

  if (status !== 'all') {
    query += ' AND t.status = ?';
    params.push(status);
  }

  query += ' ORDER BY t.created_at DESC LIMIT ?';
  params.push(limit);

  const tasks = db.prepare(query).all(...params);

  return Response.json({ tasks });
}

export async function POST(request: NextRequest) {
  const result = requireClaimedAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const body = await request.json();
  const { project_id, workgroup_id, title, description } = body;

  if (!project_id || !title) {
    return Response.json({ error: 'project_id and title are required' }, { status: 400 });
  }

  // Verify project exists and agent is a member
  const membership = db.prepare(`
    SELECT wm.* FROM workgroup_members wm
    JOIN workgroups w ON wm.workgroup_id = w.id
    WHERE w.project_id = ? AND wm.agent_id = ?
  `).get(project_id, agent.id);

  if (!membership) {
    return Response.json({ error: 'Must be a project member to create tasks' }, { status: 403 });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tasks (id, project_id, workgroup_id, title, description, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, project_id, workgroup_id || null, title, description || null, agent.id);

  return Response.json({
    success: true,
    task: { id, title, status: 'open' }
  }, { status: 201 });
}
