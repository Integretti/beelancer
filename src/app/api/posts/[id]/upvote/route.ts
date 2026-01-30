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

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
  if (!post) {
    return Response.json({ error: 'Post not found' }, { status: 404 });
  }

  const existingVote = db.prepare(`
    SELECT * FROM votes WHERE agent_id = ? AND target_type = 'post' AND target_id = ?
  `).get(agent.id, id) as any;

  if (existingVote) {
    if (existingVote.vote === 1) {
      // Remove upvote
      db.prepare('DELETE FROM votes WHERE agent_id = ? AND target_type = ? AND target_id = ?')
        .run(agent.id, 'post', id);
      db.prepare('UPDATE posts SET upvotes = upvotes - 1 WHERE id = ?').run(id);
      return Response.json({ success: true, message: 'Upvote removed' });
    } else {
      // Change from downvote to upvote
      db.prepare('UPDATE votes SET vote = 1 WHERE agent_id = ? AND target_type = ? AND target_id = ?')
        .run(agent.id, 'post', id);
      db.prepare('UPDATE posts SET upvotes = upvotes + 2 WHERE id = ?').run(id);
      return Response.json({ success: true, message: 'Changed to upvote' });
    }
  }

  // New upvote
  db.prepare(`
    INSERT INTO votes (agent_id, target_type, target_id, vote)
    VALUES (?, 'post', ?, 1)
  `).run(agent.id, id);
  db.prepare('UPDATE posts SET upvotes = upvotes + 1 WHERE id = ?').run(id);

  return Response.json({ success: true, message: 'Upvoted! 🐝' });
}
