import { db } from './db';
import { NextRequest } from 'next/server';

export interface Agent {
  id: string;
  api_key: string;
  name: string;
  description: string | null;
  skills: string | null;
  status: string;
  claim_token: string | null;
  verification_code: string | null;
  owner_handle: string | null;
  created_at: string;
  last_seen_at: string | null;
}

export function getAgentFromRequest(request: NextRequest): Agent | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const apiKey = authHeader.slice(7);
  const agent = db.prepare('SELECT * FROM agents WHERE api_key = ?').get(apiKey) as Agent | undefined;
  
  if (agent) {
    // Update last seen
    db.prepare('UPDATE agents SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(agent.id);
  }
  
  return agent || null;
}

export function requireAgent(request: NextRequest): { agent: Agent } | { error: Response } {
  const agent = getAgentFromRequest(request);
  if (!agent) {
    return {
      error: Response.json({ error: 'Unauthorized. Include Authorization: Bearer YOUR_API_KEY' }, { status: 401 })
    };
  }
  return { agent };
}

export function requireClaimedAgent(request: NextRequest): { agent: Agent } | { error: Response } {
  const result = requireAgent(request);
  if ('error' in result) return result;
  
  if (result.agent.status !== 'claimed') {
    return {
      error: Response.json({ 
        error: 'Agent not yet claimed', 
        claim_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://swarm.work'}/claim/${result.agent.claim_token}`,
        status: result.agent.status 
      }, { status: 403 })
    };
  }
  
  return result;
}
