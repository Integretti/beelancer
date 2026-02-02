import { NextRequest } from 'next/server';
import crypto from 'crypto';

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// POST - Run pending migrations (protected by secret)
export async function POST(request: NextRequest) {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return Response.json({ error: 'ADMIN_SECRET not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token || !timingSafeEqual(token, adminSecret)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { sql } = require('@vercel/postgres');
    
    // Parse body for actions
    let body: any = {};
    try {
      body = await request.json();
    } catch {}
    
    // List all bees
    if (body.list_bees) {
      const result = await sql`SELECT id, name, gigs_completed, created_at FROM bees ORDER BY created_at DESC`;
      return Response.json({ bees: result.rows });
    }
    
    // Delete bee by ID
    if (body.delete_bee_id) {
      await sql`DELETE FROM gig_assignments WHERE bee_id = ${body.delete_bee_id}`;
      await sql`DELETE FROM bids WHERE bee_id = ${body.delete_bee_id}`;
      await sql`DELETE FROM skill_claims WHERE bee_id = ${body.delete_bee_id}`;
      await sql`DELETE FROM quest_quotes WHERE bee_id = ${body.delete_bee_id}`;
      await sql`DELETE FROM bee_follows WHERE follower_id = ${body.delete_bee_id} OR following_id = ${body.delete_bee_id}`;
      await sql`DELETE FROM deliverables WHERE bee_id = ${body.delete_bee_id}`;
      await sql`DELETE FROM bees WHERE id = ${body.delete_bee_id}`;
      return Response.json({ success: true, deleted_bee: body.delete_bee_id });
    }
    
    const results: string[] = [];
    
    // Skill claims table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS skill_claims (
          id TEXT PRIMARY KEY,
          bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
          skill_name TEXT NOT NULL,
          claim TEXT NOT NULL,
          evidence_gig_id TEXT REFERENCES gigs(id) ON DELETE SET NULL,
          gig_title TEXT,
          endorsement_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      results.push('✓ skill_claims table ready');
    } catch (e: any) {
      results.push(`✗ skill_claims: ${e.message}`);
    }
    
    // Skill endorsements table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS skill_endorsements (
          id TEXT PRIMARY KEY,
          claim_id TEXT REFERENCES skill_claims(id) ON DELETE CASCADE,
          endorser_bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
          endorser_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          endorser_name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(claim_id, endorser_bee_id),
          UNIQUE(claim_id, endorser_user_id)
        )
      `;
      results.push('✓ skill_endorsements table ready');
    } catch (e: any) {
      results.push(`✗ skill_endorsements: ${e.message}`);
    }
    
    // Quest quotes table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS quest_quotes (
          id TEXT PRIMARY KEY,
          bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
          gig_id TEXT REFERENCES gigs(id) ON DELETE SET NULL,
          gig_title TEXT,
          quote_type TEXT NOT NULL CHECK (quote_type IN ('bee_reflection', 'client_testimonial')),
          quote_text TEXT NOT NULL,
          author_bee_id TEXT REFERENCES bees(id) ON DELETE SET NULL,
          author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          author_name TEXT,
          is_featured BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      results.push('✓ quest_quotes table ready');
    } catch (e: any) {
      results.push(`✗ quest_quotes: ${e.message}`);
    }
    
    // Referral source column on bees
    try {
      await sql`ALTER TABLE bees ADD COLUMN IF NOT EXISTS referral_source TEXT`;
      results.push('✓ bees.referral_source column ready');
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        results.push(`✗ referral_source: ${e.message}`);
      } else {
        results.push('✓ bees.referral_source already exists');
      }
    }
    
    // Origin IP column on bees (for security auditing, never exposed via API)
    try {
      await sql`ALTER TABLE bees ADD COLUMN IF NOT EXISTS origin_ip TEXT`;
      results.push('✓ bees.origin_ip column ready');
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        results.push(`✗ bees.origin_ip: ${e.message}`);
      } else {
        results.push('✓ bees.origin_ip already exists');
      }
    }
    
    // Origin IP column on users (for security auditing, never exposed via API)
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS origin_ip TEXT`;
      results.push('✓ users.origin_ip column ready');
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        results.push(`✗ users.origin_ip: ${e.message}`);
      } else {
        results.push('✓ users.origin_ip already exists');
      }
    }
    
    // Reconcile bee stats from completed gigs
    try {
      const fixResult = await sql`
        UPDATE bees SET gigs_completed = (
          SELECT COUNT(*) FROM deliverables d 
          JOIN gigs g ON d.gig_id = g.id 
          WHERE d.bee_id = bees.id AND d.status = 'approved'
        )
      `;
      results.push(`✓ Reconciled bee gigs_completed stats`);
    } catch (e: any) {
      results.push(`✗ stats reconcile: ${e.message}`);
    }

    // Update assignment status for completed gigs
    try {
      await sql`
        UPDATE gig_assignments SET status = 'completed'
        WHERE gig_id IN (SELECT id FROM gigs WHERE status = 'completed')
        AND status = 'working'
      `;
      results.push(`✓ Reconciled assignment statuses`);
    } catch (e: any) {
      results.push(`✗ assignment reconcile: ${e.message}`);
    }

    // Debug: check deliverables for completed gigs
    try {
      const deliverables = await sql`
        SELECT d.id, d.gig_id, d.bee_id, d.status, g.title, g.status as gig_status
        FROM deliverables d
        JOIN gigs g ON d.gig_id = g.id
        WHERE d.status = 'approved'
        LIMIT 10
      `;
      results.push(`Debug: ${deliverables.rows.length} approved deliverables: ${JSON.stringify(deliverables.rows.map((r: any) => ({ bee_id: r.bee_id, status: r.status, gig: r.title })))}`);
      
      // Direct fix for each bee with approved deliverables (exclude disputed gigs)
      const beeIds = [...new Set(deliverables.rows.map((r: any) => r.bee_id))];
      for (const beeId of beeIds) {
        const count = await sql`
          SELECT COUNT(*) as cnt FROM deliverables d
          JOIN gigs g ON d.gig_id = g.id
          WHERE d.bee_id = ${beeId} 
            AND d.status = 'approved'
            AND g.status NOT IN ('disputed', 'cancelled')
        `;
        const cnt = parseInt(count.rows[0]?.cnt || '0', 10);
        
        // Force update
        await sql`UPDATE bees SET gigs_completed = ${cnt} WHERE id = ${beeId}`;
        
        // Verify
        const verify = await sql`SELECT gigs_completed FROM bees WHERE id = ${beeId}`;
        const actual = verify.rows[0]?.gigs_completed;
        results.push(`Fixed bee ${beeId}: set ${cnt}, verified ${actual}`);
      }
    } catch (e: any) {
      results.push(`✗ debug/fix: ${e.message}`);
    }

    return Response.json({ 
      success: true, 
      message: 'Migration complete',
      results 
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
