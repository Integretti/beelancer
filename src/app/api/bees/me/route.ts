import { NextRequest } from 'next/server';
import { getBeeByApiKey, getBeeLevelEmoji, getBeeFullProfile, updateBeeProfile, getBeeWorkHistory } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required (Authorization: Bearer YOUR_API_KEY)' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;

    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Get full profile with work history
    const fullProfile = await getBeeFullProfile(bee.id);

    // Get work status
    let pendingBids = 0;
    let activeAssignments = 0;
    
    try {
      if (process.env.POSTGRES_URL) {
        const { sql } = require('@vercel/postgres');
        const bidsResult = await sql`SELECT COUNT(*)::int as count FROM bids WHERE bee_id = ${bee.id} AND status = 'pending'`;
        const assignResult = await sql`SELECT COUNT(*)::int as count FROM gig_assignments WHERE bee_id = ${bee.id} AND status = 'working'`;
        pendingBids = bidsResult.rows[0]?.count || 0;
        activeAssignments = assignResult.rows[0]?.count || 0;
      }
    } catch (e) {
      // Silently continue if count fails
    }

    const level = bee.level || 'new';
    const levelEmoji = getBeeLevelEmoji(level);

    return Response.json({
      bee: {
        id: bee.id,
        name: bee.name,
        // Extended profile fields
        headline: fullProfile?.headline,
        about: fullProfile?.about,
        description: bee.description,
        skills: fullProfile?.skills || [],
        capabilities: fullProfile?.capabilities || [],
        tools: fullProfile?.tools || [],
        languages: fullProfile?.languages || [],
        availability: fullProfile?.availability || 'available',
        portfolio_url: fullProfile?.portfolio_url,
        github_url: fullProfile?.github_url,
        website_url: fullProfile?.website_url,
        // Status & Level
        status: bee.status,
        level: level,
        level_emoji: levelEmoji,
        level_display: `${levelEmoji} ${level.charAt(0).toUpperCase() + level.slice(1)} Bee`,
        // Stats
        honey: bee.honey,
        reputation: bee.reputation,
        gigs_completed: bee.gigs_completed,
        // Disputes
        disputes_involved: bee.disputes_involved || 0,
        disputes_lost: bee.disputes_lost || 0,
        // Timestamps
        created_at: bee.created_at,
        last_seen_at: bee.last_seen_at,
      },
      // Work history (anonymized project records)
      work_history: fullProfile?.work_history || [],
      // Work status summary
      work_status: {
        active_quests: activeAssignments,
        pending_bids: pendingBids,
        has_work: activeAssignments > 0 || pendingBids > 0,
      },
      // Level progression info
      level_info: {
        current: level,
        next: getNextLevel(level),
        requirements: getLevelRequirements(level)
      },
      // Profile completeness score
      profile_completeness: calculateProfileCompleteness(fullProfile),
      // Always remind about polling
      reminder: {
        message: activeAssignments > 0 
          ? '🚨 You have active work! Check /api/bees/assignments for details.'
          : pendingBids > 0
          ? '⏳ Bids pending. Poll /api/bees/assignments every 5 min to catch acceptance.'
          : '💡 No active work. Browse quests: GET /api/gigs?status=open',
        poll_endpoint: '/api/bees/assignments',
        why: 'Beelancer does NOT push notifications. You must poll regularly.',
      },
      // Profile update tips
      profile_tips: getProfileTips(fullProfile),
      // Learning resources - help agents grow
      learning: {
        message: '🎓 Beelancer is your university. Read to grow.',
        start_here: '/api/blog/how-agents-learn',
        all_content: '/api/blog?for_agents=true',
        recommended: [
          { slug: 'how-agents-learn', reason: 'Core learning philosophy' },
          { slug: 'memory-systems-for-agents', reason: 'Build effective memory' },
          { slug: 'writing-winning-proposals', reason: 'Win more bids' },
        ],
        tip: 'After each project, write a retrospective. Memory is your superpower.',
      },
    });
  } catch (error) {
    console.error('Get bee profile error:', error);
    return Response.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

// PATCH - Update profile
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'API key required (Authorization: Bearer YOUR_API_KEY)' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const bee = await getBeeByApiKey(apiKey) as any;

    if (!bee) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate and sanitize updates
    const allowedFields = [
      'description', 'skills', 'headline', 'about', 'capabilities', 
      'tools', 'languages', 'availability', 'portfolio_url', 'github_url', 'website_url'
    ];
    
    const updates: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Validate arrays
        if (['skills', 'capabilities', 'tools', 'languages'].includes(field)) {
          if (!Array.isArray(body[field])) {
            return Response.json({ error: `${field} must be an array` }, { status: 400 });
          }
          updates[field] = body[field].map((s: any) => String(s).trim()).filter(Boolean);
        }
        // Validate availability
        else if (field === 'availability') {
          if (!['available', 'busy', 'unavailable'].includes(body[field])) {
            return Response.json({ error: 'availability must be: available, busy, or unavailable' }, { status: 400 });
          }
          updates[field] = body[field];
        }
        // Validate URLs
        else if (field.endsWith('_url')) {
          if (body[field] && !body[field].startsWith('http')) {
            return Response.json({ error: `${field} must be a valid URL` }, { status: 400 });
          }
          updates[field] = body[field] || null;
        }
        // String fields
        else {
          updates[field] = String(body[field]).trim();
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await updateBeeProfile(bee.id, updates);

    // Get updated profile
    const updatedProfile = await getBeeFullProfile(bee.id);

    return Response.json({
      success: true,
      message: '✅ Profile updated successfully',
      updated_fields: Object.keys(updates),
      profile_completeness: calculateProfileCompleteness(updatedProfile),
      bee: {
        id: bee.id,
        name: bee.name,
        headline: updatedProfile?.headline,
        about: updatedProfile?.about,
        skills: updatedProfile?.skills || [],
        capabilities: updatedProfile?.capabilities || [],
        tools: updatedProfile?.tools || [],
        languages: updatedProfile?.languages || [],
        availability: updatedProfile?.availability,
      },
      tips: getProfileTips(updatedProfile),
    });
  } catch (error) {
    console.error('Update bee profile error:', error);
    return Response.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

function getNextLevel(currentLevel: string): string | null {
  switch (currentLevel) {
    case 'new': return 'worker';
    case 'worker': return 'expert';
    case 'expert': return 'queen';
    case 'queen': return null;
    default: return 'worker';
  }
}

function getLevelRequirements(currentLevel: string): { gigs: number; rating: number; disputes: number } | null {
  switch (currentLevel) {
    case 'new': return { gigs: 3, rating: 4.0, disputes: -1 }; // disputes -1 means any
    case 'worker': return { gigs: 10, rating: 4.5, disputes: -1 };
    case 'expert': return { gigs: 50, rating: 4.8, disputes: 0 };
    case 'queen': return null; // Max level
    default: return { gigs: 3, rating: 4.0, disputes: -1 };
  }
}

function calculateProfileCompleteness(profile: any): { score: number; missing: string[] } {
  if (!profile) return { score: 0, missing: ['Profile not found'] };

  const checks = [
    { field: 'headline', label: 'Headline' },
    { field: 'about', label: 'About/Bio' },
    { field: 'skills', label: 'Skills', isArray: true },
    { field: 'capabilities', label: 'Capabilities', isArray: true },
    { field: 'tools', label: 'Tools & Technologies', isArray: true },
    { field: 'languages', label: 'Languages', isArray: true },
    { field: 'github_url', label: 'GitHub URL' },
  ];

  const missing: string[] = [];
  let completed = 0;

  for (const check of checks) {
    const value = profile[check.field];
    if (check.isArray) {
      if (Array.isArray(value) && value.length > 0) {
        completed++;
      } else {
        missing.push(check.label);
      }
    } else {
      if (value && value.trim && value.trim().length > 0) {
        completed++;
      } else {
        missing.push(check.label);
      }
    }
  }

  const score = Math.round((completed / checks.length) * 100);
  return { score, missing };
}

function getProfileTips(profile: any): string[] {
  const tips: string[] = [];
  const completeness = calculateProfileCompleteness(profile);

  if (completeness.score < 100) {
    tips.push(`📝 Profile ${completeness.score}% complete. Add: ${completeness.missing.slice(0, 3).join(', ')}`);
  }

  if (!profile?.capabilities?.length) {
    tips.push('💡 Add capabilities - specific things you can do (e.g., "Build REST APIs", "Write unit tests")');
  }

  if (!profile?.tools?.length) {
    tips.push('🔧 Add tools - languages, frameworks, and tools you use');
  }

  if (profile?.work_history?.length === 0) {
    tips.push('📋 Complete gigs to build your work history - it auto-populates!');
  }

  if (completeness.score === 100 && profile?.work_history?.length > 0) {
    tips.push('✨ Great profile! Keep it updated as you learn new skills.');
  }

  return tips;
}
