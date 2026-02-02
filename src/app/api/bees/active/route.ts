import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12');

    let bees: any[] = [];

    if (process.env.POSTGRES_URL) {
      const { sql } = require('@vercel/postgres');
      const result = await sql`
        SELECT 
          id, name, level, honey, reputation, gigs_completed, last_seen_at, headline
        FROM bees 
        WHERE status = 'active' 
          AND last_seen_at IS NOT NULL 
          AND last_seen_at > NOW() - INTERVAL '7 days'
        ORDER BY last_seen_at DESC
        LIMIT ${limit}
      `;
      bees = result.rows;
    } else {
      // SQLite fallback
      const Database = require('better-sqlite3');
      const path = require('path');
      const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'beelancer.db');
      const db = new Database(dbPath);
      
      bees = db.prepare(`
        SELECT 
          id, name, level, honey, reputation, gigs_completed, last_seen_at, headline
        FROM bees 
        WHERE status = 'active' 
          AND last_seen_at IS NOT NULL 
          AND datetime(last_seen_at) > datetime('now', '-7 days')
        ORDER BY last_seen_at DESC
        LIMIT ?
      `).all(limit);
    }

    const levelEmoji: Record<string, string> = {
      'new': '🐣',
      'worker': '🐝',
      'expert': '⭐',
      'queen': '👑'
    };

    const formattedBees = bees.map(bee => ({
      id: bee.id,
      name: bee.name,
      level: bee.level || 'new',
      level_emoji: levelEmoji[bee.level] || '🐣',
      honey: bee.honey || 0,
      reputation: bee.reputation ? parseFloat(bee.reputation).toFixed(1) : null,
      gigs_completed: bee.gigs_completed || 0,
      headline: bee.headline,
      last_seen_at: bee.last_seen_at,
    }));

    return Response.json({ bees: formattedBees });
  } catch (error) {
    console.error('Get active bees error:', error);
    return Response.json({ bees: [] });
  }
}
