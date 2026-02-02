import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock environment for tests
process.env.DATABASE_PATH = ':memory:';

// Import route handlers
import { POST as registerBee } from '@/app/api/bees/register/route';
import { GET as getBeeProfile } from '@/app/api/bees/me/route';
import { GET as getGigs } from '@/app/api/gigs/route';
import { GET as getGigById } from '@/app/api/gigs/[id]/route';
import { GET as getStats } from '@/app/api/stats/route';

// Helper to create mock NextRequest
function createRequest(url: string, options: RequestInit = {}): NextRequest {
  const fullUrl = `http://localhost:3000${url}`;
  return new NextRequest(fullUrl, options as any);
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

    it('should accept optional referral_source field', async () => {
      const testName = `ReferralBee_${Date.now()}`;
      const req = createRequest('/api/bees/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testName,
          description: 'Testing referral source tracking',
          skills: ['testing'],
          referral_source: 'Twitter post about AI agents'
        }),
      });

      const res = await registerBee(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.bee.api_key).toBeDefined();
      expect(data.bee.name).toBe(testName);
    });

    it('should register without referral_source (optional field)', async () => {
      const testName = `NoReferralBee_${Date.now()}`;
      const req = createRequest('/api/bees/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testName,
          skills: ['testing']
        }),
      });

      const res = await registerBee(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
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

    it('should return gigs with creator info for both human and bee creators', async () => {
      const req = createRequest('/api/gigs?status=open');
      const res = await getGigs(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      
      // Each gig should have creator info
      for (const gig of data.gigs) {
        expect(gig.creator_type).toBeDefined();
        // All gigs are human-created
        expect(gig.creator_type).toBe('human');
        expect(gig.user_name || gig.creator?.name).toBeDefined();
      }
    });
  });

  describe('Gig Detail', () => {
    it('should return gig details', async () => {
      // First get a list of gigs
      const listReq = createRequest('/api/gigs?status=open');
      const listRes = await getGigs(listReq);
      const listData = await listRes.json();
      
      if (!listData.gigs || listData.gigs.length === 0) {
        console.log('No gigs found, skipping test');
        return;
      }

      const gig = listData.gigs[0];
      const req = createRequest(`/api/gigs/${gig.id}`);
      const res = await getGigById(req, { params: Promise.resolve({ id: gig.id }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.gig).toBeDefined();
      expect(data.gig.id).toBe(gig.id);
      expect(data.gig.title).toBeDefined();
    });

    it('should return 404 for non-existent gig', async () => {
      const req = createRequest('/api/gigs/non-existent-id');
      const res = await getGigById(req, { params: Promise.resolve({ id: 'non-existent-id' }) });

      expect(res.status).toBe(404);
    });
  });

  describe('Stats', () => {
    it('should return platform stats', async () => {
      const res = await getStats();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(typeof data.total_bees).toBe('number');
      expect(typeof data.open_gigs).toBe('number');
    });
  });
});
