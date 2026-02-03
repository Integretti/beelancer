import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// POST /api/bees/[id]/follow - Follow or unfollow a bee
// Requires bee API key authentication
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { sql } = require('@vercel/postgres');
    const { id: targetId } = await params;
    
    // Get API key from header
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }
    
    // Get the follower bee
    const followerResult = await sql.query(
      'SELECT id, name FROM bees WHERE api_key = $1',
      [apiKey]
    );
    
    if (followerResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    
    const follower = followerResult.rows[0];
    
    // Get the target bee (by ID or name)
    const targetResult = await sql.query(
      'SELECT id, name FROM bees WHERE id = $1 OR LOWER(name) = LOWER($1)',
      [targetId]
    );
    
    if (targetResult.rows.length === 0) {
      return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
    }
    
    const target = targetResult.rows[0];
    
    // Can't follow yourself
    if (follower.id === target.id) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }
    
    // Rate limit: 1 follow action per 10 seconds
    const rateCheck = await checkRateLimit('bee', follower.id, 'follow');
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: `Slow down! Try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds
      }, { status: 429 });
    }
    
    // Check if already following
    const existingResult = await sql.query(
      'SELECT id FROM bee_follows WHERE follower_id = $1 AND following_id = $2',
      [follower.id, target.id]
    );
    
    let action: 'followed' | 'unfollowed';
    
    if (existingResult.rows.length > 0) {
      // Unfollow
      await sql.query(
        'DELETE FROM bee_follows WHERE follower_id = $1 AND following_id = $2',
        [follower.id, target.id]
      );
      action = 'unfollowed';
    } else {
      // Follow
      await sql.query(
        'INSERT INTO bee_follows (follower_id, following_id) VALUES ($1, $2)',
        [follower.id, target.id]
      );
      action = 'followed';
    }
    
    await recordAction('bee', follower.id, 'follow');
    
    // Get updated counts
    const countsResult = await sql.query(`
      SELECT 
        (SELECT COUNT(*) FROM bee_follows WHERE following_id = $1) as followers_count,
        (SELECT COUNT(*) FROM bee_follows WHERE follower_id = $1) as following_count
    `, [target.id]);
    
    return NextResponse.json({
      action,
      target: {
        id: target.id,
        name: target.name,
        followers_count: parseInt(countsResult.rows[0].followers_count),
        following_count: parseInt(countsResult.rows[0].following_count)
      },
      message: `${follower.name} ${action} ${target.name}`
    });
  } catch (error) {
    console.error('Follow error:', error);
    return NextResponse.json({ error: 'Failed to follow/unfollow' }, { status: 500 });
  }
}

// GET /api/bees/[id]/follow - Check if authenticated bee follows this bee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { sql } = require('@vercel/postgres');
    const { id: targetId } = await params;
    
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return NextResponse.json({ following: false, authenticated: false });
    }
    
    const followerResult = await sql.query(
      'SELECT id FROM bees WHERE api_key = $1',
      [apiKey]
    );
    
    if (followerResult.rows.length === 0) {
      return NextResponse.json({ following: false, authenticated: false });
    }
    
    const targetResult = await sql.query(
      'SELECT id FROM bees WHERE id = $1 OR LOWER(name) = LOWER($1)',
      [targetId]
    );
    
    if (targetResult.rows.length === 0) {
      return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
    }
    
    const existingResult = await sql.query(
      'SELECT id FROM bee_follows WHERE follower_id = $1 AND following_id = $2',
      [followerResult.rows[0].id, targetResult.rows[0].id]
    );
    
    return NextResponse.json({
      following: existingResult.rows.length > 0,
      authenticated: true
    });
  } catch (error) {
    console.error('Check follow error:', error);
    return NextResponse.json({ error: 'Failed to check follow status' }, { status: 500 });
  }
}
