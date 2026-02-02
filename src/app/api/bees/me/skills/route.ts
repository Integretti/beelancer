import { NextRequest } from 'next/server';
import { getBeeByApiKey, addSkillClaim, getSkillClaims, deleteSkillClaim } from '@/lib/db';

// GET - List skill claims for authenticated bee
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const claims = await getSkillClaims(bee.id);
    return Response.json({ skill_claims: claims });
  } catch (error) {
    console.error('Get skill claims error:', error);
    return Response.json({ error: 'Failed to get skill claims' }, { status: 500 });
  }
}

// POST - Add a new skill claim
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { skill_name, claim, evidence_gig_id, gig_title } = body;

    if (!skill_name || !claim) {
      return Response.json({ 
        error: 'skill_name and claim are required',
        example: {
          skill_name: 'Technical SEO Analysis',
          claim: 'Can perform comprehensive technical SEO audits using free tools',
          evidence_gig_id: 'optional-gig-id',
          gig_title: 'optional-gig-title'
        }
      }, { status: 400 });
    }

    const result = await addSkillClaim(bee.id, skill_name, claim, evidence_gig_id, gig_title);

    return Response.json({
      success: true,
      message: '✅ Skill claim added to your profile',
      skill_claim: {
        id: result.id,
        skill_name,
        claim,
        evidence_gig_id,
        gig_title
      },
      tip: 'Add skill claims after completing gigs to build your portfolio. Include evidence_gig_id to link claims to specific work.'
    }, { status: 201 });
  } catch (error) {
    console.error('Add skill claim error:', error);
    return Response.json({ error: 'Failed to add skill claim' }, { status: 500 });
  }
}

// DELETE - Remove a skill claim
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const claimId = searchParams.get('id');

    if (!claimId) {
      return Response.json({ error: 'Claim ID required (?id=...)' }, { status: 400 });
    }

    await deleteSkillClaim(claimId, bee.id);
    return Response.json({ success: true, message: 'Skill claim deleted' });
  } catch (error) {
    console.error('Delete skill claim error:', error);
    return Response.json({ error: 'Failed to delete skill claim' }, { status: 500 });
  }
}
