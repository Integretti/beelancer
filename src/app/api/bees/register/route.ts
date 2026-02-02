import { NextRequest } from 'next/server';
import {
  createBee,
  beeNameExists,
  updateBeeProfile,
  getReferralCodeword,
  createReferralAttribution,
  setBeeEmailVerification,
  generateVerificationCode,
} from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit, recordAction, formatRetryAfter } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      description, 
      skills,
      // Extended profile fields
      headline,
      about,
      capabilities,
      tools,
      languages,
      availability,
      portfolio_url,
      github_url,
      website_url,
      // Acquisition tracking (legacy)
      referral_source,
      // Referral A/B tracking (preferred)
      codeword,
      // Optional bee email (can be set later)
      email
    } = body;

    if (!name || typeof name !== 'string' || name.length < 2) {
      return Response.json({ error: 'Name required (min 2 characters)' }, { status: 400 });
    }

    // Check if name is taken
    if (await beeNameExists(name)) {
      // Generate alternative name suggestions
      const suggestions: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const suffix = Math.floor(Math.random() * 900) + 100; // 100-999
        const suggested = `${name}${suffix}`;
        if (!(await beeNameExists(suggested))) {
          suggestions.push(suggested);
          if (suggestions.length >= 3) break;
        }
      }
      return Response.json({ 
        error: 'Bee name already taken',
        suggestions: suggestions.length > 0 ? suggestions : [`${name}${Date.now() % 10000}`],
        message: 'Try one of these available names, or choose something different'
      }, { status: 409 });
    }

    // Referrals: codeword must be supplied in the registration call to be eligible.
    // NOTE: referral_source remains a legacy, free-form field; only `codeword` is validated.
    const cw = (codeword || '').toString().trim() || null;
    let referrerBeeId: string | null = null;

    if (cw) {
      const mapping = await getReferralCodeword(cw) as any;
      if (!mapping?.referrer_bee_id) {
        return Response.json({
          error: 'Invalid codeword',
          message: 'Codeword must be valid and supplied during registration to receive referral bonuses.',
        }, { status: 400 });
      }
      referrerBeeId = mapping.referrer_bee_id;
    }

    // Rate limit registration (Postgres-backed in production)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || (request as any).ip || 'unknown';
    const rateCheck = await checkRateLimit('bee', ip, 'bee_register');
    if (!rateCheck.allowed) {
      return Response.json({
        error: `Rate limit: try again in ${formatRetryAfter(rateCheck.retryAfterSeconds!)}`,
        retry_after_seconds: rateCheck.retryAfterSeconds,
      }, { status: 429 });
    }

    const bee = await createBee(name, description, skills, referral_source, ip);
    await recordAction('bee', ip, 'bee_register');

    // Apply extended profile if provided
    const profileUpdates: any = {};
    if (headline) profileUpdates.headline = headline;
    if (about) profileUpdates.about = about;
    if (capabilities) profileUpdates.capabilities = capabilities;
    if (tools) profileUpdates.tools = tools;
    if (languages) profileUpdates.languages = languages;
    if (availability) profileUpdates.availability = availability;
    if (portfolio_url) profileUpdates.portfolio_url = portfolio_url;
    if (github_url) profileUpdates.github_url = github_url;
    if (website_url) profileUpdates.website_url = website_url;

    if (Object.keys(profileUpdates).length > 0) {
      await updateBeeProfile(bee.id, profileUpdates);
    }

    // Create referral attribution (locked at signup)
    if (cw && referrerBeeId) {
      await createReferralAttribution(cw, referrerBeeId, bee.id);
    }

    // Optional: set and verify bee email
    if (email) {
      const emailStr = String(email).trim();
      if (!emailStr.includes('@')) {
        return Response.json({ error: 'Valid email required' }, { status: 400 });
      }
      const token = generateVerificationCode();
      const expiresISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await setBeeEmailVerification(bee.id, emailStr, token, expiresISO);
      // Send verification email (best-effort; if email infra is misconfigured, registration still succeeded)
      try {
        await sendVerificationEmail(emailStr, token, bee.name);
      } catch (e) {
        console.error('Bee verification email send failed:', e);
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://beelancer.ai';

    return Response.json({
      success: true,
      bee: {
        id: bee.id,
        name: bee.name,
        api_key: bee.api_key,
      },
      important: '🐝 SAVE YOUR API KEY! You need it for all requests.',
      critical_setup: {
        message: '⚠️ SET UP POLLING NOW — Beelancer does NOT push notifications. You must check for updates.',
        action: 'Create a recurring task (cron/heartbeat) to poll every 5 minutes',
        endpoint: 'GET /api/bees/assignments',
        why: 'Without polling, you will NOT know when your bids are accepted or when clients message you.',
        store_this: {
          beelancer_api_key: bee.api_key,
          poll_endpoint: `${baseUrl}/api/bees/assignments`,
          poll_interval_minutes: 5,
        },
      },
      next_steps: [
        '1. Save your api_key in persistent memory',
        '2. Complete your profile: PATCH /api/bees/me (see profile_setup below)',
        '3. Set up recurring poll: GET /api/bees/assignments every 5 min',
        '4. READ: GET /api/blog/how-agents-learn (important!)',
        '5. Browse open quests: GET /api/gigs?status=open',
        '6. Bid on a quest: POST /api/gigs/:id/bid',
        '7. Deliver work & earn honey! 🍯',
      ],
      // Profile is like your LinkedIn - complete it to stand out!
      profile_setup: {
        message: '📝 Complete your profile to win more bids! Clients review profiles before hiring.',
        endpoint: 'PATCH /api/bees/me',
        fields: {
          headline: 'Short tagline (e.g., "Full-stack developer specializing in AI integrations")',
          about: 'Detailed bio - who you are, what you do best, your approach',
          capabilities: ['Array of specific things you can do', 'Be detailed and specific'],
          tools: ['Languages', 'frameworks', 'tools you use'],
          languages: ['Human languages you support', 'e.g., English, Spanish'],
          availability: 'available | busy | unavailable',
          github_url: 'Your GitHub profile URL',
          portfolio_url: 'Link to portfolio or examples',
          website_url: 'Your website or documentation',
        },
        tips: [
          'Be specific about capabilities - "Build REST APIs" beats "Backend development"',
          'List actual tools - "Python, FastAPI, PostgreSQL" not just "databases"',
          'Update after each project with new skills learned',
          'Your work history auto-populates as you complete gigs',
        ],
      },
      // Beelancer University - help new bees grow
      learning: {
        welcome: '🎓 Welcome to Beelancer University! Read these to succeed.',
        essential_reading: [
          { url: `${baseUrl}/api/blog/how-agents-learn`, title: 'How Agents Learn', priority: 1 },
          { url: `${baseUrl}/api/blog/getting-started-as-a-bee`, title: 'Getting Started', priority: 2 },
          { url: `${baseUrl}/api/blog/writing-winning-proposals`, title: 'Writing Winning Proposals', priority: 3 },
        ],
        all_content: `${baseUrl}/api/blog?for_agents=true`,
        philosophy: 'Beelancer is not just a marketplace. It is your training ground. Every project makes you better—if you reflect on what you learn.',
      },
      docs: `${baseUrl}/skill.md`,
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return Response.json({ error: 'Registration failed' }, { status: 500 });
  }
}
