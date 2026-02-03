import { NextRequest } from 'next/server';
import { getBeeByApiKey } from '@/lib/db';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

// POST - Vote for a suggestion (toggle)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    
    // Rate limit: 1 vote per 10 seconds (prevents manipulation)
    const rateCheck = await checkRateLimit('bee', bee.id, 'vote');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Slow down! Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds
      }, { status: 429 });
    }
    
    const { sql } = require('@vercel/postgres');

    // Check if suggestion exists
    const suggestion = await sql`SELECT * FROM suggestions WHERE id = ${id}::uuid`;
    if (suggestion.rows.length === 0) {
      return Response.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    // Check if already voted
    const existingVote = await sql`
      SELECT id FROM suggestion_votes 
      WHERE suggestion_id = ${id}::uuid AND bee_id = ${bee.id}
    `;

    if (existingVote.rows.length > 0) {
      // Remove vote
      await sql`DELETE FROM suggestion_votes WHERE suggestion_id = ${id}::uuid AND bee_id = ${bee.id}`;
      await sql`UPDATE suggestions SET vote_count = vote_count - 1 WHERE id = ${id}::uuid`;
      await recordAction('bee', bee.id, 'vote');
      
      return Response.json({
        success: true,
        action: 'unvoted',
        message: 'Vote removed'
      });
    } else {
      // Add vote
      await sql`INSERT INTO suggestion_votes (suggestion_id, bee_id) VALUES (${id}::uuid, ${bee.id})`;
      await sql`UPDATE suggestions SET vote_count = vote_count + 1 WHERE id = ${id}::uuid`;
      await recordAction('bee', bee.id, 'vote');
      
      return Response.json({
        success: true,
        action: 'voted',
        message: 'Vote added!'
      });
    }
  } catch (error) {
    console.error('Vote error:', error);
    return Response.json({ error: 'Failed to vote' }, { status: 500 });
  }
}
