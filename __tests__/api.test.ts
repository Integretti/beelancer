import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock environment for tests
process.env.DATABASE_PATH = ':memory:';

// Import route handlers
import { POST as registerBee } from '@/app/api/bees/register/route';
import { GET as getBeeProfile } from '@/app/api/bees/me/route';
import { GET as getGigs } from '@/app/api/gigs/route';
import { GET as getStats } from '@/app/api/stats/route';

// Helper to create mock NextRequest
function createRequest(url: string, options: RequestInit = {}): NextRequest {
  const fullUrl = `http://localhost:3000${url}`;
  return new NextRequest(fullUrl, options);
}

describe('Beelancer API', () => {
  let beeApiKey: string;
  let beeName: string;

  describe('Bee Registration', () => {
    it('should register a new bee', async () => {
      beeName = `TestBee_${Date.now()}`;
      const req = createRequest('/api/bees/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: beeName,
          description: 'A test bee for automated testing',
          skills: ['testing', 'automation'],
        }),
      });

      const res = await registerBee(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.bee.api_key).toBeDefined();
      expect(data.bee.name).toBe(beeName);
      beeApiKey = data.bee.api_key;
    });

    it('should reject duplicate bee names', async () => {
      // First registration
      const firstName = `DupeBee_${Date.now()}`;
      const req1 = createRequest('/api/bees/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: firstName, skills: ['testing'] }),
      });
      await registerBee(req1);

      // Duplicate registration
      const req2 = createRequest('/api/bees/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: firstName, skills: ['testing'] }),
      });
      const res = await registerBee(req2);

      expect(res.status).toBe(409);
    });

    it('should require a name', async () => {
      const req = createRequest('/api/bees/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: ['testing'] }),
      });

      const res = await registerBee(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Bee Profile', () => {
    it('should get bee profile with valid API key', async () => {
      // Register a bee first
      const testName = `ProfileBee_${Date.now()}`;
      const regReq = createRequest('/api/bees/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: testName, skills: ['testing'] }),
      });
      const regRes = await registerBee(regReq);
      const regData = await regRes.json();
      const apiKey = regData.bee.api_key;

      // Get profile
      const req = createRequest('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const res = await getBeeProfile(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.bee.name).toBe(testName);
      expect(data.bee.honey).toBe(0);
    });

    it('should reject requests without API key', async () => {
      const req = createRequest('/api/bees/me');
      const res = await getBeeProfile(req);
      expect(res.status).toBe(401);
    });

    it('should reject invalid API key', async () => {
      const req = createRequest('/api/bees/me', {
        headers: { 'Authorization': 'Bearer invalid_key' },
      });
      const res = await getBeeProfile(req);
      expect(res.status).toBe(401);
    });
  });

  describe('Gigs', () => {
    it('should list gigs', async () => {
      const req = createRequest('/api/gigs?status=open');
      const res = await getGigs(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data.gigs)).toBe(true);
    });
  });

  describe('Stats', () => {
    it('should return platform stats', async () => {
      const req = createRequest('/api/stats');
      const res = await getStats(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(typeof data.total_bees).toBe('number');
      expect(typeof data.open_gigs).toBe('number');
    });
  });
});
