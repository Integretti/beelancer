import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ============ Database Setup ============
// Uses Vercel Postgres when available, falls back to SQLite for local dev

let db: any;
let isPostgres = false;
let dbInitialized = false;
let dbError: Error | null = null;

// Check if running on Vercel
const isVercel = process.env.VERCEL === '1';

if (process.env.POSTGRES_URL) {
  // Vercel Postgres
  isPostgres = true;
  const { sql } = require('@vercel/postgres');
  db = sql;
  
  // Initialize tables (run once)
  initPostgres()
    .then(() => { dbInitialized = true; })
    .catch((err) => { dbError = err; console.error('Postgres init error:', err); });
} else if (isVercel) {
  // On Vercel without Postgres - use in-memory SQLite (data won't persist between requests!)
  console.warn('⚠️ Running on Vercel without POSTGRES_URL - using in-memory SQLite. Data will not persist!');
  const Database = require('better-sqlite3');
  db = new Database(':memory:');
  initSQLite();
  dbInitialized = true;
} else {
  // Local SQLite
  const Database = require('better-sqlite3');
  const path = require('path');
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'beelancer.db');
  db = new Database(dbPath);
  initSQLite();
  dbInitialized = true;
}

async function initPostgres() {
  const { sql } = require('@vercel/postgres');
  
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bees (
      id TEXT PRIMARY KEY,
      api_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      skills TEXT,
      status TEXT DEFAULT 'active',
      owner_id TEXT REFERENCES users(id),
      honey INTEGER DEFAULT 0,
      reputation REAL DEFAULT 0.0,
      gigs_completed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gigs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      requirements TEXT,
      price_cents INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      category TEXT,
      deadline TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      gig_id TEXT REFERENCES gigs(id) ON DELETE CASCADE,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      proposal TEXT NOT NULL,
      estimated_hours REAL,
      honey_requested INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(gig_id, bee_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gig_assignments (
      id TEXT PRIMARY KEY,
      gig_id TEXT REFERENCES gigs(id) ON DELETE CASCADE,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      honey_split INTEGER DEFAULT 100,
      status TEXT DEFAULT 'working',
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(gig_id, bee_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS deliverables (
      id TEXT PRIMARY KEY,
      gig_id TEXT REFERENCES gigs(id) ON DELETE CASCADE,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      type TEXT,
      content TEXT,
      url TEXT,
      status TEXT DEFAULT 'submitted',
      feedback TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      gig_id TEXT REFERENCES gigs(id) ON DELETE CASCADE,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(gig_id, bee_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS honey_ledger (
      id TEXT PRIMARY KEY,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      gig_id TEXT REFERENCES gigs(id),
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

function initSQLite() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_expires TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bees (
      id TEXT PRIMARY KEY,
      api_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      skills TEXT,
      status TEXT DEFAULT 'active',
      owner_id TEXT REFERENCES users(id),
      honey INTEGER DEFAULT 0,
      reputation REAL DEFAULT 0.0,
      gigs_completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS gigs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      requirements TEXT,
      price_cents INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      category TEXT,
      deadline TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      gig_id TEXT REFERENCES gigs(id) ON DELETE CASCADE,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      proposal TEXT NOT NULL,
      estimated_hours REAL,
      honey_requested INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(gig_id, bee_id)
    );

    CREATE TABLE IF NOT EXISTS gig_assignments (
      id TEXT PRIMARY KEY,
      gig_id TEXT REFERENCES gigs(id) ON DELETE CASCADE,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      honey_split INTEGER DEFAULT 100,
      status TEXT DEFAULT 'working',
      assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(gig_id, bee_id)
    );

    CREATE TABLE IF NOT EXISTS deliverables (
      id TEXT PRIMARY KEY,
      gig_id TEXT REFERENCES gigs(id) ON DELETE CASCADE,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      type TEXT,
      content TEXT,
      url TEXT,
      status TEXT DEFAULT 'submitted',
      feedback TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      gig_id TEXT REFERENCES gigs(id) ON DELETE CASCADE,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(gig_id, bee_id)
    );

    CREATE TABLE IF NOT EXISTS honey_ledger (
      id TEXT PRIMARY KEY,
      bee_id TEXT REFERENCES bees(id) ON DELETE CASCADE,
      gig_id TEXT REFERENCES gigs(id),
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_bees_api_key ON bees(api_key);
    CREATE INDEX IF NOT EXISTS idx_gigs_status ON gigs(status);
    CREATE INDEX IF NOT EXISTS idx_gigs_user ON gigs(user_id);
  `);
}

// ============ Helper Functions ============

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verify;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateApiKey(): string {
  return `bee_${uuidv4().replace(/-/g, '')}`;
}

export function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ============ Database Operations ============
// These work for both Postgres and SQLite

export async function createUser(email: string, password: string, name?: string) {
  const id = uuidv4();
  const password_hash = hashPassword(password);
  const verification_token = generateVerificationCode();
  const verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    await sql`
      INSERT INTO users (id, email, password_hash, name, verification_token, verification_expires)
      VALUES (${id}, ${email.toLowerCase()}, ${password_hash}, ${name || null}, ${verification_token}, ${verification_expires})
    `;
  } else {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, verification_token, verification_expires)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, email.toLowerCase(), password_hash, name || null, verification_token, verification_expires);
  }

  return { id, email, verification_token };
}

export async function verifyUserEmail(token: string): Promise<string | null> {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`
      UPDATE users SET email_verified = 1, verification_token = NULL 
      WHERE verification_token = ${token} AND verification_expires > NOW() AND email_verified = 0
      RETURNING id
    `;
    return result.rows.length > 0 ? result.rows[0].id : null;
  } else {
    const user = db.prepare(`
      SELECT id FROM users 
      WHERE verification_token = ? AND verification_expires > datetime('now') AND email_verified = 0
    `).get(token) as any;

    if (user) {
      db.prepare(`UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?`).run(user.id);
      return user.id;
    }
    return null;
  }
}

export async function getUserByEmail(email: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
    return result.rows[0];
  } else {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  }
}

export async function getUserById(id: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`SELECT * FROM users WHERE id = ${id}`;
    return result.rows[0];
  } else {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
}

export async function createSession(userId: string): Promise<string> {
  const id = uuidv4();
  const token = generateToken();
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    await sql`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (${id}, ${userId}, ${token}, ${expires_at})`;
  } else {
    db.prepare(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`).run(id, userId, token, expires_at);
  }

  return token;
}

export async function getSessionUser(token: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`
      SELECT s.user_id, u.* FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token} AND s.expires_at > NOW()
    `;
    return result.rows[0];
  } else {
    return db.prepare(`
      SELECT s.user_id, u.* FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);
  }
}

export async function deleteSession(token: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    await sql`DELETE FROM sessions WHERE token = ${token}`;
  } else {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
}

export async function createBee(name: string, description?: string, skills?: string[]) {
  const id = uuidv4();
  const api_key = generateApiKey();

  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    await sql`
      INSERT INTO bees (id, api_key, name, description, skills)
      VALUES (${id}, ${api_key}, ${name}, ${description || null}, ${skills ? JSON.stringify(skills) : null})
    `;
  } else {
    db.prepare(`
      INSERT INTO bees (id, api_key, name, description, skills)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, api_key, name, description || null, skills ? JSON.stringify(skills) : null);
  }

  return { id, api_key, name };
}

export async function getBeeByApiKey(apiKey: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`SELECT * FROM bees WHERE api_key = ${apiKey}`;
    if (result.rows[0]) {
      await sql`UPDATE bees SET last_seen_at = NOW() WHERE api_key = ${apiKey}`;
    }
    return result.rows[0];
  } else {
    const bee = db.prepare('SELECT * FROM bees WHERE api_key = ?').get(apiKey);
    if (bee) {
      db.prepare('UPDATE bees SET last_seen_at = CURRENT_TIMESTAMP WHERE api_key = ?').run(apiKey);
    }
    return bee;
  }
}

export async function getBeeById(id: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`SELECT * FROM bees WHERE id = ${id}`;
    return result.rows[0];
  } else {
    return db.prepare('SELECT * FROM bees WHERE id = ?').get(id);
  }
}

export async function createGig(userId: string, data: { title: string; description?: string; requirements?: string; price_cents?: number; category?: string; deadline?: string }) {
  const id = uuidv4();

  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    await sql`
      INSERT INTO gigs (id, user_id, title, description, requirements, price_cents, category, deadline, status)
      VALUES (${id}, ${userId}, ${data.title}, ${data.description || null}, ${data.requirements || null}, ${data.price_cents || 0}, ${data.category || null}, ${data.deadline || null}, 'draft')
    `;
  } else {
    db.prepare(`
      INSERT INTO gigs (id, user_id, title, description, requirements, price_cents, category, deadline, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(id, userId, data.title, data.description || null, data.requirements || null, data.price_cents || 0, data.category || null, data.deadline || null);
  }

  return { id, ...data };
}

export async function updateGig(id: string, userId: string, data: any) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    // For simplicity, handle common updates
    if (data.status) {
      await sql`UPDATE gigs SET status = ${data.status}, updated_at = NOW() WHERE id = ${id} AND user_id = ${userId}`;
    }
    if (data.title) {
      await sql`UPDATE gigs SET title = ${data.title}, updated_at = NOW() WHERE id = ${id} AND user_id = ${userId}`;
    }
  } else {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);
    db.prepare(`UPDATE gigs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`).run(...values, id, userId);
  }
}

export async function getGigById(id: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`
      SELECT g.*, u.name as user_name, u.email as user_email,
        (SELECT COUNT(*)::int FROM gig_assignments WHERE gig_id = g.id) as bee_count,
        (SELECT COUNT(*)::int FROM bids WHERE gig_id = g.id AND status = 'pending') as bid_count
      FROM gigs g
      JOIN users u ON g.user_id = u.id
      WHERE g.id = ${id}
    `;
    return result.rows[0];
  } else {
    return db.prepare(`
      SELECT g.*, u.name as user_name, u.email as user_email,
        (SELECT COUNT(*) FROM gig_assignments WHERE gig_id = g.id) as bee_count,
        (SELECT COUNT(*) FROM bids WHERE gig_id = g.id AND status = 'pending') as bid_count
      FROM gigs g
      JOIN users u ON g.user_id = u.id
      WHERE g.id = ?
    `).get(id);
  }
}

export async function listGigs(options: { status?: string; userId?: string; limit?: number; offset?: number } = {}) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    let result;
    if (options.userId) {
      result = await sql`
        SELECT g.*, u.name as user_name,
          (SELECT COUNT(*)::int FROM gig_assignments WHERE gig_id = g.id) as bee_count,
          (SELECT COUNT(*)::int FROM bids WHERE gig_id = g.id AND status = 'pending') as bid_count
        FROM gigs g
        JOIN users u ON g.user_id = u.id
        WHERE g.user_id = ${options.userId}
        ORDER BY g.created_at DESC
        LIMIT ${options.limit || 50}
      `;
    } else if (options.status) {
      result = await sql`
        SELECT g.*, u.name as user_name,
          (SELECT COUNT(*)::int FROM gig_assignments WHERE gig_id = g.id) as bee_count,
          (SELECT COUNT(*)::int FROM bids WHERE gig_id = g.id AND status = 'pending') as bid_count
        FROM gigs g
        JOIN users u ON g.user_id = u.id
        WHERE g.status = ${options.status}
        ORDER BY g.created_at DESC
        LIMIT ${options.limit || 50}
      `;
    } else {
      result = await sql`
        SELECT g.*, u.name as user_name,
          (SELECT COUNT(*)::int FROM gig_assignments WHERE gig_id = g.id) as bee_count,
          (SELECT COUNT(*)::int FROM bids WHERE gig_id = g.id AND status = 'pending') as bid_count
        FROM gigs g
        JOIN users u ON g.user_id = u.id
        ORDER BY g.created_at DESC
        LIMIT ${options.limit || 50}
      `;
    }
    return result.rows;
  } else {
    let query = `
      SELECT g.*, u.name as user_name,
        (SELECT COUNT(*) FROM gig_assignments WHERE gig_id = g.id) as bee_count,
        (SELECT COUNT(*) FROM bids WHERE gig_id = g.id AND status = 'pending') as bid_count
      FROM gigs g
      JOIN users u ON g.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options.status) {
      query += ' AND g.status = ?';
      params.push(options.status);
    }
    if (options.userId) {
      query += ' AND g.user_id = ?';
      params.push(options.userId);
    }

    query += ' ORDER BY g.created_at DESC';
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    return db.prepare(query).all(...params);
  }
}

export async function createBid(gigId: string, beeId: string, proposal: string, estimatedHours?: number, honeyRequested?: number) {
  const id = uuidv4();

  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    await sql`
      INSERT INTO bids (id, gig_id, bee_id, proposal, estimated_hours, honey_requested)
      VALUES (${id}, ${gigId}, ${beeId}, ${proposal}, ${estimatedHours || null}, ${honeyRequested || null})
    `;
  } else {
    db.prepare(`
      INSERT INTO bids (id, gig_id, bee_id, proposal, estimated_hours, honey_requested)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, gigId, beeId, proposal, estimatedHours || null, honeyRequested || null);
  }

  return { id };
}

export async function getBidsForGig(gigId: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`
      SELECT b.*, bee.name as bee_name, bee.reputation, bee.gigs_completed
      FROM bids b
      JOIN bees bee ON b.bee_id = bee.id
      WHERE b.gig_id = ${gigId}
      ORDER BY b.created_at DESC
    `;
    return result.rows;
  } else {
    return db.prepare(`
      SELECT b.*, bee.name as bee_name, bee.reputation, bee.gigs_completed
      FROM bids b
      JOIN bees bee ON b.bee_id = bee.id
      WHERE b.gig_id = ?
      ORDER BY b.created_at DESC
    `).all(gigId);
  }
}

export async function acceptBid(bidId: string, gigId: string, userId: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    
    const gigResult = await sql`SELECT * FROM gigs WHERE id = ${gigId} AND user_id = ${userId}`;
    if (gigResult.rows.length === 0) return false;

    const bidResult = await sql`SELECT * FROM bids WHERE id = ${bidId} AND gig_id = ${gigId}`;
    if (bidResult.rows.length === 0) return false;
    const bid = bidResult.rows[0];

    await sql`UPDATE bids SET status = 'accepted' WHERE id = ${bidId}`;
    await sql`UPDATE bids SET status = 'rejected' WHERE gig_id = ${gigId} AND id != ${bidId}`;

    const assignId = uuidv4();
    await sql`INSERT INTO gig_assignments (id, gig_id, bee_id, honey_split) VALUES (${assignId}, ${gigId}, ${bid.bee_id}, 100)`;
    await sql`UPDATE gigs SET status = 'in_progress', updated_at = NOW() WHERE id = ${gigId}`;

    return true;
  } else {
    const gig = db.prepare('SELECT * FROM gigs WHERE id = ? AND user_id = ?').get(gigId, userId);
    if (!gig) return false;

    const bid = db.prepare('SELECT * FROM bids WHERE id = ? AND gig_id = ?').get(bidId, gigId) as any;
    if (!bid) return false;

    db.prepare("UPDATE bids SET status = 'accepted' WHERE id = ?").run(bidId);
    db.prepare("UPDATE bids SET status = 'rejected' WHERE gig_id = ? AND id != ?").run(gigId, bidId);

    const assignId = uuidv4();
    db.prepare(`INSERT INTO gig_assignments (id, gig_id, bee_id, honey_split) VALUES (?, ?, ?, 100)`).run(assignId, gigId, bid.bee_id);
    db.prepare("UPDATE gigs SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(gigId);

    return true;
  }
}

export async function submitDeliverable(gigId: string, beeId: string, data: { title: string; type?: string; content?: string; url?: string }) {
  const id = uuidv4();

  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    await sql`
      INSERT INTO deliverables (id, gig_id, bee_id, title, type, content, url)
      VALUES (${id}, ${gigId}, ${beeId}, ${data.title}, ${data.type || null}, ${data.content || null}, ${data.url || null})
    `;
    await sql`UPDATE gigs SET status = 'review', updated_at = NOW() WHERE id = ${gigId}`;
  } else {
    db.prepare(`
      INSERT INTO deliverables (id, gig_id, bee_id, title, type, content, url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, gigId, beeId, data.title, data.type || null, data.content || null, data.url || null);
    db.prepare("UPDATE gigs SET status = 'review', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(gigId);
  }

  return { id };
}

export async function approveDeliverable(deliverableId: string, gigId: string, userId: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');

    const gigResult = await sql`SELECT * FROM gigs WHERE id = ${gigId} AND user_id = ${userId}`;
    if (gigResult.rows.length === 0) return false;
    const gig = gigResult.rows[0];

    const delResult = await sql`SELECT * FROM deliverables WHERE id = ${deliverableId} AND gig_id = ${gigId}`;
    if (delResult.rows.length === 0) return false;
    const deliverable = delResult.rows[0];

    await sql`UPDATE deliverables SET status = 'approved' WHERE id = ${deliverableId}`;
    await sql`UPDATE gigs SET status = 'completed', updated_at = NOW() WHERE id = ${gigId}`;

    await awardHoney(deliverable.bee_id, gigId, gig.price_cents, 'gig_completed');

    return true;
  } else {
    const gig = db.prepare('SELECT * FROM gigs WHERE id = ? AND user_id = ?').get(gigId, userId) as any;
    if (!gig) return false;

    const deliverable = db.prepare('SELECT * FROM deliverables WHERE id = ? AND gig_id = ?').get(deliverableId, gigId) as any;
    if (!deliverable) return false;

    db.prepare("UPDATE deliverables SET status = 'approved' WHERE id = ?").run(deliverableId);
    db.prepare("UPDATE gigs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(gigId);

    await awardHoney(deliverable.bee_id, gigId, gig.price_cents, 'gig_completed');

    return true;
  }
}

export async function awardHoney(beeId: string, gigId: string | null, amount: number, type: string, note?: string) {
  const id = uuidv4();

  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    await sql`
      INSERT INTO honey_ledger (id, bee_id, gig_id, amount, type, note)
      VALUES (${id}, ${beeId}, ${gigId}, ${amount}, ${type}, ${note || null})
    `;
    await sql`UPDATE bees SET honey = honey + ${amount} WHERE id = ${beeId}`;
    if (type === 'gig_completed') {
      await sql`UPDATE bees SET gigs_completed = gigs_completed + 1 WHERE id = ${beeId}`;
    }
  } else {
    db.prepare(`
      INSERT INTO honey_ledger (id, bee_id, gig_id, amount, type, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, beeId, gigId, amount, type, note || null);
    db.prepare('UPDATE bees SET honey = honey + ? WHERE id = ?').run(amount, beeId);
    if (type === 'gig_completed') {
      db.prepare('UPDATE bees SET gigs_completed = gigs_completed + 1 WHERE id = ?').run(beeId);
    }
  }
}

export async function getGigStats() {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`
      SELECT 
        (SELECT COUNT(*)::int FROM gigs WHERE status = 'open') as open_gigs,
        (SELECT COUNT(*)::int FROM gigs WHERE status = 'in_progress') as in_progress,
        (SELECT COUNT(*)::int FROM gigs WHERE status = 'completed') as completed,
        (SELECT COUNT(*)::int FROM bees) as total_bees,
        (SELECT COALESCE(SUM(honey), 0)::int FROM bees) as total_honey
    `;
    return result.rows[0];
  } else {
    return db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM gigs WHERE status = 'open') as open_gigs,
        (SELECT COUNT(*) FROM gigs WHERE status = 'in_progress') as in_progress,
        (SELECT COUNT(*) FROM gigs WHERE status = 'completed') as completed,
        (SELECT COUNT(*) FROM bees) as total_bees,
        (SELECT COALESCE(SUM(honey), 0) FROM bees) as total_honey
    `).get();
  }
}

export async function beeNameExists(name: string): Promise<boolean> {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`SELECT id FROM bees WHERE LOWER(name) = LOWER(${name})`;
    return result.rows.length > 0;
  } else {
    return !!db.prepare('SELECT id FROM bees WHERE LOWER(name) = LOWER(?)').get(name);
  }
}

export async function getGigAssignment(gigId: string, beeId: string) {
  if (isPostgres) {
    const { sql } = require('@vercel/postgres');
    const result = await sql`SELECT * FROM gig_assignments WHERE gig_id = ${gigId} AND bee_id = ${beeId}`;
    return result.rows[0];
  } else {
    return db.prepare('SELECT * FROM gig_assignments WHERE gig_id = ? AND bee_id = ?').get(gigId, beeId);
  }
}

export { db };
