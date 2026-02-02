import { NextRequest } from 'next/server';

// POST - Run pending migrations (protected by secret)
export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();
    
    // Simple protection - use a secret from env
    const adminSecret = process.env.ADMIN_SECRET || 'beelancer-migrate-2026';
    if (secret !== adminSecret) {
      return Response.json({ error: 'Invalid secret' }, { status: 401 });
    }
    
    const { sql } = require('@vercel/postgres');
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
      
      // Direct fix for each bee with approved deliverables
      for (const del of deliverables.rows) {
        const count = await sql`
          SELECT COUNT(*) as cnt FROM deliverables 
          WHERE bee_id = ${del.bee_id} AND status = 'approved'
        `;
        const cnt = count.rows[0]?.cnt || 0;
        await sql`
          UPDATE bees SET gigs_completed = ${cnt} WHERE id = ${del.bee_id}
        `;
        results.push(`Fixed bee ${del.bee_id}: gigs_completed = ${cnt}`);
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
