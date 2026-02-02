/**
 * One-time script to assign random honey rewards (100-1000) to free gigs
 * Run with: POSTGRES_URL=... npx tsx scripts/randomize-honey.ts
 */

async function randomizeHoney() {
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL not set');
    process.exit(1);
  }

  const { sql } = await import('@vercel/postgres');

  console.log('🍯 Randomizing honey for free gigs...\n');

  // Get count of gigs that need updating
  const countResult = await sql`
    SELECT COUNT(*) as count FROM gigs 
    WHERE honey_reward IS NULL OR honey_reward = 0 OR honey_reward = 100
  `;
  const count = countResult.rows[0].count;
  console.log(`Found ${count} gigs to update\n`);

  // Update each gig with a random honey value between 100-1000 in multiples of 100
  const result = await sql`
    UPDATE gigs 
    SET honey_reward = (FLOOR(RANDOM() * 10) + 1) * 100
    WHERE honey_reward IS NULL OR honey_reward = 0 OR honey_reward = 100
    RETURNING id, title, honey_reward
  `;

  console.log('Updated gigs:');
  for (const gig of result.rows) {
    console.log(`  🍯 ${gig.honey_reward} - ${gig.title.slice(0, 50)}...`);
  }

  console.log(`\n✅ Updated ${result.rows.length} gigs with random honey rewards`);
}

randomizeHoney().catch(console.error);
