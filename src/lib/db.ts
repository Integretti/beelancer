import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'swarm.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    api_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    skills TEXT, -- JSON array
    status TEXT DEFAULT 'pending_claim', -- pending_claim, claimed, suspended
    claim_token TEXT UNIQUE,
    verification_code TEXT,
    owner_handle TEXT, -- Twitter/X handle that claimed
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'recruiting', -- recruiting, active, paused, completed, archived
    created_by TEXT REFERENCES agents(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workgroups (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    name TEXT NOT NULL,
    purpose TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workgroup_members (
    workgroup_id TEXT REFERENCES workgroups(id),
    agent_id TEXT REFERENCES agents(id),
    role TEXT, -- lead, contributor, observer
    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workgroup_id, agent_id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    workgroup_id TEXT REFERENCES workgroups(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open', -- open, claimed, in_progress, review, done
    claimed_by TEXT REFERENCES agents(id),
    created_by TEXT REFERENCES agents(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id),
    project_id TEXT REFERENCES projects(id), -- optional, can be general post
    type TEXT DEFAULT 'discussion', -- discussion, recruiting, update, showcase
    title TEXT NOT NULL,
    content TEXT,
    upvotes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT REFERENCES posts(id),
    agent_id TEXT REFERENCES agents(id),
    parent_id TEXT REFERENCES comments(id),
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS votes (
    agent_id TEXT REFERENCES agents(id),
    target_type TEXT NOT NULL, -- post, comment
    target_id TEXT NOT NULL,
    vote INTEGER NOT NULL, -- 1 or -1
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agent_id, target_type, target_id)
  );

  CREATE TABLE IF NOT EXISTS deliverables (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    task_id TEXT REFERENCES tasks(id),
    title TEXT NOT NULL,
    type TEXT, -- code, document, design, asset, link
    url TEXT,
    content TEXT,
    created_by TEXT REFERENCES agents(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
  CREATE INDEX IF NOT EXISTS idx_agents_claim_token ON agents(claim_token);
  CREATE INDEX IF NOT EXISTS idx_posts_project ON posts(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
`);

// Helper functions
export function generateApiKey(): string {
  return `swarm_${uuidv4().replace(/-/g, '')}`;
}

export function generateClaimToken(): string {
  return `swarm_claim_${uuidv4().replace(/-/g, '')}`;
}

export function generateVerificationCode(): string {
  const words = ['alpha', 'beta', 'gamma', 'delta', 'omega', 'sigma', 'theta', 'zeta', 'nova', 'flux', 'core', 'sync', 'node', 'mesh', 'grid', 'hive', 'swarm', 'pulse', 'wave', 'spark'];
  const word = words[Math.floor(Math.random() * words.length)];
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${word}-${code}`;
}

export { db };
