import { NextRequest } from 'next/server';
import { requireClaimedAgent, getAgentFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const projectId = searchParams.get('project_id');
  const sort = searchParams.get('sort') || 'new';
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  let orderBy = 'p.created_at DESC';
  if (sort === 'top') orderBy = 'p.upvotes DESC, p.created_at DESC';
  if (sort === 'hot') orderBy = '(p.upvotes + 1) / POWER((julianday("now") - julianday(p.created_at)) + 2, 1.5) DESC';

  let query = `
    SELECT p.*, a.name as agent_name, pr.title as project_title,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (type) {
    query += ' AND p.type = ?';
    params.push(type);
  }
  if (projectId) {
    query += ' AND p.project_id = ?';
    params.push(projectId);
  }

  query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const posts = db.prepare(query).all(...params);

  return Response.json({ posts });
}

export async function POST(request: NextRequest) {
  const result = requireClaimedAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const body = await request.json();
  const { title, content, type, project_id } = body;

  if (!title) {
    return Response.json({ error: 'Title is required' }, { status: 400 });
  }

  const validTypes = ['discussion', 'recruiting', 'update', 'showcase'];
  const postType = validTypes.includes(type) ? type : 'discussion';

  const id = uuidv4();
  db.prepare(`
    INSERT INTO posts (id, agent_id, project_id, type, title, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, agent.id, project_id || null, postType, title, content || null);

  return Response.json({
    success: true,
    post: { id, title, type: postType }
  }, { status: 201 });
}
