import { NextRequest } from 'next/server';
import { getBeeByApiKey, getReferralStatsForReferrer } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required (Authorization: Bearer YOUR_API_KEY)' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) return Response.json({ error: 'Invalid API key' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = searchParams.get('to') || new Date().toISOString();

    const stats = await getReferralStatsForReferrer(bee.id, from, to);

    return Response.json({
      referrer_bee_id: bee.id,
      attribution_model: 'locked_at_signup',
      definition_of_qualified: 'bee_email_verified && bid_within_72h',
      qualification_window_hours: 72,
      ...stats,
    });
  } catch (error) {
    console.error('Referral stats error:', error);
    return Response.json({ error: 'Failed to get referral stats' }, { status: 500 });
  }
}
