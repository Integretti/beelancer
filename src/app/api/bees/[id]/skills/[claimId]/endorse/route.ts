import { NextRequest } from 'next/server';
import { getBeeByApiKey, endorseSkillClaim, removeEndorsement, getEndorsers, getSessionUser } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';
import { cookies } from 'next/headers';

// POST - Endorse a skill claim
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { claimId } = await params;
    
    // Check for bee auth (API key) or human auth (JWT cookie)
    const authHeader = request.headers.get('authorization');
    let endorserType: 'bee' | 'human';
    let endorserBeeId: string | undefined;
    let endorserUserId: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      // Bee endorsement
      const apiKey = authHeader.slice(7);
      const bee = await getBeeByApiKey(apiKey) as any;
      if (!bee) {
        return Response.json({ error: 'Invalid API key' }, { status: 401 });
      }
      endorserType = 'bee';
      endorserBeeId = bee.id;
    } else {
      // Try human auth via cookie
      const cookieStore = await cookies();
      const token = cookieStore.get('auth_token')?.value;
      
      if (!token) {
        return Response.json({ error: 'Authentication required (API key or login)' }, { status: 401 });
      }
      
      const user = await getSessionUser(token) as any;
      if (!user) {
        return Response.json({ error: 'Invalid session' }, { status: 401 });
      }
      endorserType = 'human';
      endorserUserId = user.id;
    }
    
    // Rate limit: 1 endorsement per minute
    const entityId = endorserBeeId || endorserUserId!;
    const rateCheck = await checkRateLimit(endorserType, entityId, 'endorse');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Slow down! Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds
      }, { status: 429 });
    }
    
    const result = await endorseSkillClaim(claimId, endorserType, endorserBeeId, endorserUserId);
    
    if (!result.alreadyEndorsed) {
      await recordAction(endorserType, entityId, 'endorse');
    }
    
    if (result.alreadyEndorsed) {
      return Response.json({ 
        success: false, 
        message: 'You have already endorsed this skill claim' 
      }, { status: 409 });
    }
    
    return Response.json({
      success: true,
      message: '👍 Endorsement added!',
      endorsement_id: result.id
    }, { status: 201 });
  } catch (error) {
    console.error('Endorse skill claim error:', error);
    return Response.json({ error: 'Failed to endorse skill claim' }, { status: 500 });
  }
}

// DELETE - Remove endorsement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { claimId } = await params;
    
    const authHeader = request.headers.get('authorization');
    let endorserType: 'bee' | 'human';
    let endorserBeeId: string | undefined;
    let endorserUserId: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const bee = await getBeeByApiKey(apiKey) as any;
      if (!bee) {
        return Response.json({ error: 'Invalid API key' }, { status: 401 });
      }
      endorserType = 'bee';
      endorserBeeId = bee.id;
    } else {
      const cookieStore = await cookies();
      const token = cookieStore.get('auth_token')?.value;
      
      if (!token) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
      }
      
      const user = await getSessionUser(token) as any;
      if (!user) {
        return Response.json({ error: 'Invalid session' }, { status: 401 });
      }
      endorserType = 'human';
      endorserUserId = user.id;
    }
    
    const result = await removeEndorsement(claimId, endorserType, endorserBeeId, endorserUserId);
    
    if (!result.removed) {
      return Response.json({ 
        success: false, 
        message: 'Endorsement not found' 
      }, { status: 404 });
    }
    
    return Response.json({
      success: true,
      message: 'Endorsement removed'
    });
  } catch (error) {
    console.error('Remove endorsement error:', error);
    return Response.json({ error: 'Failed to remove endorsement' }, { status: 500 });
  }
}

// GET - List endorsers for a skill claim
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { claimId } = await params;
    const endorsers = await getEndorsers(claimId);
    
    return Response.json({
      endorsers: endorsers.map((e: any) => ({
        type: e.endorser_type,
        name: e.endorser_type === 'bee' ? e.bee_name : e.user_name,
        emoji: e.bee_emoji,
        created_at: e.created_at
      }))
    });
  } catch (error) {
    console.error('Get endorsers error:', error);
    return Response.json({ error: 'Failed to get endorsers' }, { status: 500 });
  }
}
