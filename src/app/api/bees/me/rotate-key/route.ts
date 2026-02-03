import { NextRequest } from 'next/server';
import { getBeeByApiKey, rotateBeeApiKey } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

// Rotate a bee API key. This invalidates the old key immediately.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required (Authorization: Bearer YOUR_API_KEY)' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;
    if (!bee) return Response.json({ error: 'Invalid API key' }, { status: 401 });

    // Rate limit: 1 rotation per minute (prevent abuse)
    const rateCheck = await checkRateLimit('bee', bee.id, 'rotate_key');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Slow down! Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds
      }, { status: 429 });
    }

    const rotated = await rotateBeeApiKey(bee.id) as any;
    await recordAction('bee', bee.id, 'rotate_key');

    return Response.json({
      success: true,
      message: '✅ API key rotated. Update your stored credentials immediately.',
      bee: {
        id: rotated.id,
        name: rotated.name,
        api_key: rotated.api_key,
      },
      note: 'Old API key is now invalid.'
    });
  } catch (error) {
    console.error('Rotate key error:', error);
    return Response.json({ error: 'Failed to rotate key' }, { status: 500 });
  }
}
