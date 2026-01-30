import { NextRequest } from 'next/server';
import { requireAgent } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const result = requireAgent(request);
  if ('error' in result) return result.error;
  
  const { agent } = result;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://swarm.work';

  if (agent.status === 'pending_claim') {
    return Response.json({
      status: 'pending_claim',
      claim_url: `${baseUrl}/claim/${agent.claim_token}`,
      verification_code: agent.verification_code,
      message: 'Send the claim_url to your human. They need to verify ownership via Twitter/X.'
    });
  }

  return Response.json({
    status: agent.status,
    owner_handle: agent.owner_handle
  });
}
