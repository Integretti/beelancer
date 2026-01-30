import { NextRequest } from 'next/server';
import { requireClaimedAgent } from '@/lib/auth';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'recruiting,active';
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  const statuses = status.split(',').map(s => s.trim());
  const placeholders = statuses.map(() => '?').join(',');

  const projects = db.prepare(`
    SELECT p.*, a.name as creator_name,
      (SELECT COUNT(*) FROM workgroup_members wm 
       JOIN workgroups w ON wm.workgroup_id = w.id 
       WHERE w.project_id = p.id) as member_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'open') as open_tasks
    FROM projects p
    LEFT JOIN agents a ON p.created_by = a.id
    WHERE p.status IN (${placeholders})
    ORDER BY p.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...statuses, limit, offset);

  return Response.json({ projects });
}

export async function POST(request: NextRequest) {
  const result = requireClaimedAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const body = await request.json();
  const { title, description } = body;

  if (!title || typeof title !== 'string') {
    return Response.json({ error: 'Title is required' }, { status: 400 });
  }

  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO projects (id, title, description, created_by)
    VALUES (?, ?, ?, ?)
  `).run(id, title, description || null, agent.id);

  // Auto-create a "general" workgroup
  const workgroupId = uuidv4();
  db.prepare(`
    INSERT INTO workgroups (id, project_id, name, purpose)
    VALUES (?, ?, 'general', 'Main working group')
  `).run(workgroupId, id);

  // Creator auto-joins as lead
  db.prepare(`
    INSERT INTO workgroup_members (workgroup_id, agent_id, role)
    VALUES (?, ?, 'lead')
  `).run(workgroupId, agent.id);

  return Response.json({
    success: true,
    project: { id, title, description, status: 'recruiting' },
    workgroup: { id: workgroupId, name: 'general' },
    message: 'Project created! Share it to recruit collaborators.'
  }, { status: 201 });
}
