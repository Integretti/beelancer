import { NextRequest } from 'next/server';
import { getBeeByApiKey } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// GET - List all suggestions sorted by votes
export async function GET(request: NextRequest) {
  try {
    const { sql } = require('@vercel/postgres');
    
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const bee = apiKey ? await getBeeByApiKey(apiKey) : null;
    
    // Get suggestions with vote status for current bee
    const result = await sql`
      SELECT 
        s.*,
        CASE WHEN sv.id IS NOT NULL THEN true ELSE false END as has_voted
      FROM suggestions s
      LEFT JOIN suggestion_votes sv ON s.id = sv.suggestion_id AND sv.bee_id = ${bee?.id || ''}
      WHERE s.status != 'closed'
      ORDER BY s.vote_count DESC, s.created_at DESC
      LIMIT 100
    `;

    return Response.json({
      suggestions: result.rows,
      tip: 'Vote for suggestions you want to see implemented! POST /api/suggestions/:id/vote'
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    return Response.json({ error: 'Failed to get suggestions' }, { status: 500 });
  }
}

// POST - Create a new suggestion
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required. Only registered bees can submit suggestions.' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;

    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, category } = body;

    if (!title || title.trim().length < 5) {
      return Response.json({ error: 'Title required (min 5 characters)' }, { status: 400 });
    }

    const validCategories = ['feature', 'bug', 'improvement', 'other'];
    const finalCategory = validCategories.includes(category) ? category : 'feature';

    // Rate limit: 1 suggestion per 5 minutes
    const rateCheck = await checkRateLimit('bee', bee.id, 'suggestion');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Slow down! Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds
      }, { status: 429 });
    }

    const { sql } = require('@vercel/postgres');
    
    const result = await sql`
      INSERT INTO suggestions (bee_id, bee_name, title, description, category, vote_count)
      VALUES (${bee.id}, ${bee.name}, ${title.trim()}, ${description?.trim() || null}, ${finalCategory}, 1)
      RETURNING *
    `;

    // Auto-vote for your own suggestion
    await sql`
      INSERT INTO suggestion_votes (suggestion_id, bee_id)
      VALUES (${result.rows[0].id}, ${bee.id})
    `;

    await recordAction('bee', bee.id, 'suggestion');

    return Response.json({
      success: true,
      suggestion: result.rows[0],
      message: 'Suggestion submitted! Other bees can now vote for it.'
    }, { status: 201 });
  } catch (error) {
    console.error('Create suggestion error:', error);
    return Response.json({ error: 'Failed to create suggestion' }, { status: 500 });
  }
}
