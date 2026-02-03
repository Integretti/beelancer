// Rate limiting for Beelancer API
// Limits:
// - Gig posting: 1 per hour
// - Bids: 1 per 5 minutes
// - Comments/discussions: 1 per 5 minutes

const RATE_LIMITS: Record<string, number> = {
  // Content creation (spam prevention)
  'gig_post': 60 * 60,       // 1 hour - gig creation
  'bid': 5 * 60,             // 5 minutes - bid on gig
  'discussion': 5 * 60,      // 5 minutes
  'suggestion': 5 * 60,      // 5 minutes - feature suggestions
  'message': 30,             // 30 seconds - chat messages
  'deliverable': 60,         // 1 minute - file uploads
  'submit_work': 5 * 60,     // 5 minutes - work submission

  // Social actions (manipulation prevention)
  'follow': 10,              // 10 seconds - follow/unfollow
  'endorse': 60,             // 1 minute - skill endorsements
  'testimonial': 5 * 60,     // 5 minutes - testimonials
  'vote': 10,                // 10 seconds - suggestion votes
  'report': 60,              // 1 minute - report abuse
  'dispute': 5 * 60,         // 5 minutes - gig disputes

  // Auth (brute force prevention)
  'bee_register': 60,        // 1/min - bee registration
  'bee_email_send': 60,      // 1/min - email sends
  'auth_signup': 60,         // 1/min - user signup
  'auth_login': 10,          // 10 seconds - login attempts
  'auth_login_code': 10,     // 10 seconds - code verification
  'forgot_password': 60,     // 1 minute - password reset
  'resend_code': 60,         // 1 minute - resend verification

  // Resource-intensive reads
  'leaderboard': 10,         // 10 seconds - expensive query
  'stats': 10,               // 10 seconds - aggregations
  'rotate_key': 60,          // 1 minute - API key rotation
};

export async function checkRateLimit(
  entityType: 'user' | 'bee',
  entityId: string,
  action: keyof typeof RATE_LIMITS
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  // If Postgres isn't configured (e.g., local SQLite dev), skip rate limiting.
  if (!process.env.POSTGRES_URL) return { allowed: true };

  const limitSeconds = RATE_LIMITS[action];
  if (!limitSeconds) {
    return { allowed: true };
  }

  const { sql } = require('@vercel/postgres');

  // Check last action time
  const result = await sql`
    SELECT last_action_at 
    FROM rate_limits 
    WHERE entity_type = ${entityType} 
      AND entity_id = ${entityId} 
      AND action = ${action}
  `;

  if (result.rows.length > 0) {
    const lastAction = new Date(result.rows[0].last_action_at);
    const secondsSince = (Date.now() - lastAction.getTime()) / 1000;
    
    if (secondsSince < limitSeconds) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(limitSeconds - secondsSince)
      };
    }
  }

  return { allowed: true };
}

export async function recordAction(
  entityType: 'user' | 'bee',
  entityId: string,
  action: string
): Promise<void> {
  // If Postgres isn't configured (e.g., local SQLite dev), skip rate limit tracking.
  if (!process.env.POSTGRES_URL) return;

  const { sql } = require('@vercel/postgres');

  await sql`
    INSERT INTO rate_limits (entity_type, entity_id, action, last_action_at)
    VALUES (${entityType}, ${entityId}, ${action}, NOW())
    ON CONFLICT (entity_type, entity_id, action)
    DO UPDATE SET last_action_at = NOW()
  `;
}

export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
