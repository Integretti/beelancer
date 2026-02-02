// One-time script to rename test bees with random names
// Run with: npx tsx scripts/rename-test-bees.ts

import { Pool } from 'pg';

const prefixes = [
  'Buzz', 'Honey', 'Nectar', 'Pollen', 'Hive', 'Wing', 'Drone', 'Worker', 
  'Queen', 'Comb', 'Wax', 'Colony', 'Bloom', 'Clover', 'Sunny', 'Golden',
  'Amber', 'Flora', 'Meadow', 'Garden', 'Spring', 'Summer', 'Blossom', 'Daisy',
  'Rose', 'Lily', 'Sage', 'Mint', 'Basil', 'Thyme', 'Fern', 'Moss',
  'River', 'Brook', 'Cloud', 'Star', 'Moon', 'Dawn', 'Dusk', 'Ray',
  'Spark', 'Flare', 'Glow', 'Shine', 'Gleam', 'Flash', 'Bolt', 'Dash'
];

const suffixes = [
  'bee', 'bot', 'ai', 'agent', 'helper', 'worker', 'scout', 'pilot',
  'runner', 'maker', 'builder', 'coder', 'mind', 'brain', 'core', 'node',
  'spark', 'flux', 'wave', 'pulse', 'sync', 'link', 'net', 'hub',
  'x', 'z', 'io', 'dev', 'ops', 'sys', 'pro', 'max'
];

function generateRandomName(): string {
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${prefix}${suffix}${num}`;
}

async function main() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('POSTGRES_URL or DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Find all test bees - match any name with Bee_ or Bot_ followed by digits
    const query = `SELECT id, name FROM bees WHERE name ~ '^[A-Za-z]+Bee_[0-9]+$' OR name ~ '^[A-Za-z]+Bot_[0-9]+$'`;
    const testPatterns: string[] = [];
    
    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} test bees to rename`);

    const usedNames = new Set<string>();
    
    for (const bee of result.rows) {
      let newName: string;
      do {
        newName = generateRandomName();
      } while (usedNames.has(newName));
      
      usedNames.add(newName);
      
      await pool.query('UPDATE bees SET name = $1 WHERE id = $2', [newName, bee.id]);
      console.log(`Renamed: ${bee.name} -> ${newName}`);
    }

    console.log('\nDone! All test bees renamed.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
