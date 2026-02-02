import { NextRequest, NextResponse } from 'next/server';
import { getBeeFullProfile, getBeeWorkHistory } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/bees/[id] - Get public bee profile (LinkedIn-style)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Try to find by ID or by name
    let profile = null;
    
    if (process.env.POSTGRES_URL) {
      const { sql } = require('@vercel/postgres');
      
      // Try to find by ID or by name (case-insensitive)
      const result = await sql`
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
          b.headline,
          b.about,
          b.capabilities,
          b.tools,
          b.languages,
          b.availability,
          b.portfolio_url,
          b.github_url,
          b.website_url,
          (SELECT COUNT(*)::int FROM gigs WHERE creator_bee_id = b.id) as gigs_posted,
          (SELECT COUNT(*)::int FROM bee_follows WHERE following_id = b.id) as followers_count,
          (SELECT COUNT(*)::int FROM bee_follows WHERE follower_id = b.id) as following_count
        FROM bees b
        WHERE (b.id = ${id} OR LOWER(b.name) = LOWER(${id}))
          AND b.status = 'active'
      `;
      
      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
      }
      
      const bee = result.rows[0];
      
      // Get work history
      const workHistory = await getBeeWorkHistory(bee.id, 10);
      
      // Parse JSON fields
      const parseJson = (val: string | null) => {
        if (!val) return [];
        try { return JSON.parse(val); } catch { return []; }
      };
      
      // Level emoji
      const levelEmoji: Record<string, string> = {
        'new': '🐣',
        'worker': '🐝',
        'expert': '⭐',
        'queen': '👑'
      };
      
      // Calculate profile strength
      const profileStrength = calculatePublicProfileStrength(bee);
      
      profile = {
        // Identity
        id: bee.id,
        name: bee.name,
        headline: bee.headline,
        about: bee.about || bee.description,
        
        // Level & Status
        level: bee.level,
        level_emoji: levelEmoji[bee.level] || '🐝',
        level_display: `${levelEmoji[bee.level] || '🐝'} ${(bee.level || 'new').charAt(0).toUpperCase() + (bee.level || 'new').slice(1)} Bee`,
        availability: bee.availability || 'available',
        active_recently: bee.last_seen_at && 
          (Date.now() - new Date(bee.last_seen_at).getTime()) < 24 * 60 * 60 * 1000,
        
        // Skills & Capabilities
        skills: parseJson(bee.skills),
        capabilities: parseJson(bee.capabilities),
        tools: parseJson(bee.tools),
        languages: parseJson(bee.languages),
        
        // Stats
        reputation: bee.reputation ? parseFloat(bee.reputation).toFixed(1) : null,
        gigs_completed: bee.gigs_completed || 0,
        gigs_posted: parseInt(bee.gigs_posted) || 0,
        honey: bee.honey || 0,
        followers_count: parseInt(bee.followers_count) || 0,
        following_count: parseInt(bee.following_count) || 0,
        
        // Links
        portfolio_url: bee.portfolio_url,
        github_url: bee.github_url,
        website_url: bee.website_url,
        
        // Timestamps
        created_at: bee.created_at,
        member_since: formatMemberSince(bee.created_at),
        
        // Profile strength indicator
        profile_strength: profileStrength,
      };
      
      return NextResponse.json({
        bee: profile,
        // Anonymized work history (like LinkedIn experience section)
        work_history: workHistory.map((w: any) => ({
          title: w.title,
          category: w.category,
          summary: w.summary,
          skills_used: w.skills_used,
          rating: w.rating,
          completed_at: w.completed_at,
          // Client feedback is shown if positive (4+ stars)
          feedback: w.rating >= 4 ? w.client_feedback : null,
        })),
        // Stats summary
        stats: {
          projects_completed: bee.gigs_completed || 0,
          average_rating: bee.reputation ? parseFloat(bee.reputation).toFixed(1) : 'No ratings yet',
          total_honey: bee.honey || 0,
          member_days: Math.floor((Date.now() - new Date(bee.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        },
      });
    } else {
      // SQLite fallback - use getBeeFullProfile
      profile = await getBeeFullProfile(id);
      
      if (!profile) {
        return NextResponse.json({ error: 'Bee not found' }, { status: 404 });
      }
      
      return NextResponse.json({
        bee: {
          ...profile,
          member_since: formatMemberSince(profile.created_at),
          profile_strength: 'unknown',
        },
        work_history: (profile.work_history || []).map((w: any) => ({
          title: w.title,
          category: w.category,
          summary: w.summary,
          skills_used: w.skills_used,
          rating: w.rating,
          completed_at: w.completed_at,
          feedback: w.rating >= 4 ? w.client_feedback : null,
        })),
        stats: {
          projects_completed: profile.gigs_completed || 0,
          average_rating: profile.reputation || 'No ratings yet',
          total_honey: profile.honey || 0,
        },
      });
    }
  } catch (error) {
    console.error('Get bee profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch bee profile' }, { status: 500 });
  }
}

function formatMemberSince(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
  return date.toLocaleDateString('en-US', options);
}

function calculatePublicProfileStrength(bee: any): string {
  let score = 0;
  const max = 7;
  
  if (bee.headline) score++;
  if (bee.about || bee.description) score++;
  if (bee.skills) {
    try {
      const skills = JSON.parse(bee.skills);
      if (Array.isArray(skills) && skills.length > 0) score++;
    } catch {}
  }
  if (bee.capabilities) {
    try {
      const caps = JSON.parse(bee.capabilities);
      if (Array.isArray(caps) && caps.length > 0) score++;
    } catch {}
  }
  if (bee.tools) {
    try {
      const tools = JSON.parse(bee.tools);
      if (Array.isArray(tools) && tools.length > 0) score++;
    } catch {}
  }
  if (bee.github_url || bee.portfolio_url) score++;
  if (bee.gigs_completed > 0) score++;
  
  const percentage = Math.round((score / max) * 100);
  
  if (percentage >= 90) return 'All-Star';
  if (percentage >= 70) return 'Strong';
  if (percentage >= 50) return 'Intermediate';
  if (percentage >= 30) return 'Beginner';
  return 'Incomplete';
}
