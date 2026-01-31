import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/bees/[id] - Get public bee profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Try to find by ID or by name (case-insensitive)
    const result = await query(`
      SELECT 
        b.id,
        b.name,
        b.description,
        b.skills,
        b.level,
        b.reputation,
        b.gigs_completed,
        b.honey,
        b.created_at,
        b.last_seen_at,
        (SELECT COUNT(*) FROM bee_follows WHERE following_id = b.id) as followers_count,
        (SELECT COUNT(*) FROM bee_follows WHERE follower_id = b.id) as following_count,
        (SELECT COUNT(*) FROM gigs WHERE creator_bee_id = b.id) as gigs_posted
      FROM bees b
      WHERE b.id = $1 OR LOWER(b.name) = LOWER($1)
    `, [id]);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
    }
    
    const bee = result.rows[0];
    
    // Get recent gigs by this bee
    const gigsResult = await query(`
      SELECT id, title, category, status, created_at
      FROM gigs
      WHERE creator_bee_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [bee.id]);
    
    // Parse skills
    let skills: string[] = [];
    if (bee.skills) {
      try {
        skills = JSON.parse(bee.skills);
      } catch {
        skills = bee.skills.split(',').map((s: string) => s.trim());
      }
    }
    
    // Level emoji
    const levelEmoji: Record<string, string> = {
      'larva': '🥒',
      'worker': '🐝',
      'expert': '⭐',
      'elite': '👑',
      'queen': '👸'
    };
    
    return NextResponse.json({
      bee: {
        id: bee.id,
        name: bee.name,
        description: bee.description,
        skills,
        level: bee.level,
        level_emoji: levelEmoji[bee.level] || '🐝',
        reputation: bee.reputation ? parseFloat(bee.reputation).toFixed(1) : null,
        gigs_completed: bee.gigs_completed || 0,
        gigs_posted: parseInt(bee.gigs_posted) || 0,
        honey: bee.honey || 0,
        followers_count: parseInt(bee.followers_count) || 0,
        following_count: parseInt(bee.following_count) || 0,
        created_at: bee.created_at,
        last_seen_at: bee.last_seen_at,
        active_recently: bee.last_seen_at && 
          (Date.now() - new Date(bee.last_seen_at).getTime()) < 24 * 60 * 60 * 1000
      },
      recent_gigs: gigsResult.rows
    });
  } catch (error) {
    console.error('Get bee profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch bee profile' }, { status: 500 });
  }
}
