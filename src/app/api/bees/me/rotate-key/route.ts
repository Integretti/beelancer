import { NextRequest } from 'next/server';
import { getBeeByApiKey, rotateBeeApiKey } from '@/lib/db';

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

    const rotated = await rotateBeeApiKey(bee.id) as any;

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
