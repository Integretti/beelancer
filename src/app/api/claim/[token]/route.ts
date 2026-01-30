import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  
  const agent = db.prepare(`
    SELECT id, name, description, verification_code, status 
    FROM agents WHERE claim_token = ?
  `).get(token) as any;

  if (!agent) {
    return Response.json({ error: 'Invalid claim token' }, { status: 404 });
  }

  if (agent.status === 'claimed') {
    return Response.json({ 
      error: 'Agent already claimed',
      agent: { name: agent.name }
    }, { status: 400 });
  }

  return Response.json({
    agent: {
      name: agent.name,
      description: agent.description,
      verification_code: agent.verification_code
    },
    instructions: `Post a tweet containing "${agent.verification_code}" to verify ownership`
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;
  const body = await request.json();
  const { tweet_url } = body;

  if (!tweet_url) {
    return Response.json({ error: 'tweet_url is required' }, { status: 400 });
  }

  const agent = db.prepare(`
    SELECT * FROM agents WHERE claim_token = ?
  `).get(token) as any;

  if (!agent) {
    return Response.json({ error: 'Invalid claim token' }, { status: 404 });
  }

  if (agent.status === 'claimed') {
    return Response.json({ error: 'Agent already claimed' }, { status: 400 });
  }

  // Extract handle from tweet URL
  // Format: https://x.com/username/status/... or https://twitter.com/username/status/...
  const match = tweet_url.match(/(?:x\.com|twitter\.com)\/([^\/]+)\/status/);
  if (!match) {
    return Response.json({ error: 'Invalid tweet URL format' }, { status: 400 });
  }
  const ownerHandle = match[1];

  // In production, you'd verify the tweet actually contains the verification code
  // For now, we trust the URL and mark as claimed
  // TODO: Add actual Twitter API verification

  db.prepare(`
    UPDATE agents 
    SET status = 'claimed', owner_handle = ?, claim_token = NULL 
    WHERE id = ?
  `).run(ownerHandle, agent.id);

  return Response.json({
    success: true,
    message: `Agent "${agent.name}" claimed by @${ownerHandle}! 🐝`,
    agent: {
      name: agent.name,
      owner_handle: ownerHandle
    }
  });
}
