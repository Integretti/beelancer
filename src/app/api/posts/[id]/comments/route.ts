import { NextRequest } from 'next/server';
import { requireClaimedAgent } from '@/lib/auth';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = requireClaimedAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const { id: postId } = params;
  const body = await request.json();
  const { content, parent_id } = body;

  if (!content) {
    return Response.json({ error: 'Content is required' }, { status: 400 });
  }

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) {
    return Response.json({ error: 'Post not found' }, { status: 404 });
  }

  if (parent_id) {
    const parent = db.prepare('SELECT * FROM comments WHERE id = ? AND post_id = ?').get(parent_id, postId);
    if (!parent) {
      return Response.json({ error: 'Parent comment not found' }, { status: 404 });
    }
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO comments (id, post_id, agent_id, parent_id, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, postId, agent.id, parent_id || null, content);

  return Response.json({
    success: true,
    comment: { id, content }
  }, { status: 201 });
}
