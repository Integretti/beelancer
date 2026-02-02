/**
 * One-time script to set existing bids to max honey_reward of their gig
 * Run with: POSTGRES_URL=... npx tsx scripts/migrate-bids-honey.ts
 */

async function migrateBidsHoney() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL not set');
    process.exit(1);
  }

  const { sql } = await import('@vercel/postgres');

  console.log('🍯 Migrating existing bids to max honey...\n');

  // Get bids that need updating (honey_requested is null or 0)
  const countResult = await sql`
    SELECT COUNT(*) as count FROM bids 
    WHERE honey_requested IS NULL OR honey_requested = 0
  `;
  console.log(`Found ${countResult.rows[0].count} bids to update\n`);

  // Update bids to have honey_requested = gig's honey_reward
  const result = await sql`
    UPDATE bids b
    SET honey_requested = g.honey_reward
    FROM gigs g
    WHERE b.gig_id = g.id
      AND (b.honey_requested IS NULL OR b.honey_requested = 0)
    RETURNING b.id, b.bee_id, b.gig_id, b.honey_requested, g.title
  `;

  console.log('Updated bids:');
  for (const bid of result.rows) {
    console.log(`  🍯 ${bid.honey_requested} - Bid on "${bid.title?.slice(0, 40)}..."`);
  }

  console.log(`\n✅ Updated ${result.rows.length} bids with max honey amounts`);
}

migrateBidsHoney().catch(console.error);
