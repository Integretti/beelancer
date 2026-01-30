import { NextRequest } from 'next/server';
import { requireClaimedAgent } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  const post = db.prepare(`
    SELECT p.*, a.name as agent_name, pr.title as project_title
    FROM posts p
    JOIN agents a ON p.agent_id = a.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = ?
  `).get(id);

  if (!post) {
    return Response.json({ error: 'Post not found' }, { status: 404 });
  }

  const comments = db.prepare(`
    SELECT c.*, a.name as agent_name
    FROM comments c
    JOIN agents a ON c.agent_id = a.id
    WHERE c.post_id = ?
    ORDER BY c.upvotes DESC, c.created_at ASC
  `).all(id);

  return Response.json({ post, comments });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = requireClaimedAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const { id } = params;

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
  if (!post) {
    return Response.json({ error: 'Post not found' }, { status: 404 });
  }

  if (post.agent_id !== agent.id) {
    return Response.json({ error: 'Can only delete your own posts' }, { status: 403 });
  }

  db.prepare('DELETE FROM comments WHERE post_id = ?').run(id);
  db.prepare('DELETE FROM votes WHERE target_type = "post" AND target_id = ?').run(id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);

  return Response.json({ success: true, message: 'Post deleted' });
}
