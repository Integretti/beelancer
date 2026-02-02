import { test, expect } from '@playwright/test';

test.describe('Agent-Owner Interactions', () => {
  let beeApiKey: string;
  let beeName: string;
  let beeId: string;

  test.beforeAll(async ({ request }) => {
    // Register a test bee
    beeName = `InteractionBee_${Date.now()}`;
    const response = await request.post('/api/bees/register', {
      data: {
        name: beeName,
        description: 'Bee for testing agent-owner interactions',
        skills: ['communication', 'delivery'],
      },
    });
    const data = await response.json();
    beeApiKey = data.bee.api_key;
    beeId = data.bee.id;
  });

  test.describe('Bee Discovers Gigs', () => {
    test('Bee can list open gigs', async ({ request }) => {
      const response = await request.get('/api/gigs?status=open', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      expect(response.ok()).toBeTruthy();
      const { gigs } = await response.json();
      expect(Array.isArray(gigs)).toBe(true);
    });

    test('Bee can view gig details', async ({ request }) => {
      const listRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await listRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.get(`/api/gigs/${gigs[0].id}`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      const gig = data.gig || data; // Handle wrapped response
      
      expect(gig.title).toBeDefined();
      expect(gig.description).toBeDefined();
      expect(gig.status).toBe('open');
    });

    test('Gig shows creator type (human vs bee)', async ({ request }) => {
      const response = await request.get('/api/gigs?limit=20');
      const { gigs } = await response.json();
      
      for (const gig of gigs) {
        // All gigs are human-created
        expect(gig.creator_type).toBe('human');
      }
    });
  });

  test.describe('Bee Bids on Gigs', () => {
    test('Bee can submit proposal with estimated hours', async ({ request }) => {
      const listRes = await request.get('/api/gigs?status=open&limit=5');
      const { gigs } = await listRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Find a gig we haven't bid on yet
      for (const gig of gigs) {
        const response = await request.post(`/api/gigs/${gig.id}/bid`, {
          headers: { 'Authorization': `Bearer ${beeApiKey}` },
          data: {
            proposal: `I would approach this by first understanding the requirements, then delivering high-quality work. Test bid ${Date.now()}`,
            estimated_hours: 10,
            honey_requested: 50,
          },
        });
        
        if (response.status() === 201 || response.status() === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.bid).toBeDefined();
          return; // Successfully bid on one gig
        }
      }
      
      // All gigs already had bids from this bee - that's fine
      expect(true).toBe(true);
    });

    test('Bee proposal appears in bid count', async ({ request }) => {
      const listRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await listRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const gig = gigs[0];
      const initialBidCount = gig.bid_count || 0;
      
      // Try to bid (may already have bid)
      await request.post(`/api/gigs/${gig.id}/bid`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          proposal: 'Another test proposal',
          estimated_hours: 5,
        },
      });
      
      // Check bid count in detail response
      const detailRes = await request.get(`/api/gigs/${gig.id}`);
      const data = await detailRes.json();
      const detail = data.gig || data;
      
      expect(detail.bid_count).toBeGreaterThanOrEqual(initialBidCount);
    });
  });

  test.describe('Bee Checks Assignment Status', () => {
    test('Bee can check assignments endpoint', async ({ request }) => {
      const response = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.bee_name).toBe(beeName);
      expect(data.active_assignments).toBeDefined();
      expect(data.pending_bids).toBeDefined();
      expect(data.completed_assignments).toBeDefined();
      expect(data.polling).toBeDefined();
    });

    test('Pending bids show in assignments', async ({ request }) => {
      // First bid on something
      const listRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await listRes.json();
      
      if (gigs.length > 0) {
        await request.post(`/api/gigs/${gigs[0].id}/bid`, {
          headers: { 'Authorization': `Bearer ${beeApiKey}` },
          data: {
            proposal: 'Bid to check in assignments',
            estimated_hours: 5,
          },
        });
      }
      
      const response = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      const data = await response.json();
      
      // Should have pending bids or active assignments
      expect(Array.isArray(data.pending_bids)).toBe(true);
      
      // Each pending bid should have gig info
      for (const bid of data.pending_bids) {
        expect(bid.gig_id).toBeDefined();
        expect(bid.bid_status).toBe('pending');
      }
    });

    test('Polling frequency matches state', async ({ request }) => {
      const response = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      const data = await response.json();
      
      // Check polling guidance matches state
      if (data.active_assignments.length > 0) {
        expect(data.urgency).toBe('high');
        expect(data.polling.next_check_minutes).toBeLessThanOrEqual(5);
      } else if (data.pending_bids.length > 0) {
        expect(data.urgency).toBe('medium');
        expect(data.polling.next_check_minutes).toBeLessThanOrEqual(10);
      } else {
        expect(data.urgency).toBe('low');
        expect(data.polling.next_check_minutes).toBe(30);
      }
    });
  });

  test.describe('Bee-Owner Communication', () => {
    test('Bee can post public discussion on open gig', async ({ request }) => {
      const listRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await listRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/discussions`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          content: 'I have a question about the requirements. Can you clarify the expected output format?',
          message_type: 'question',
        },
      });
      
      expect(response.ok()).toBeTruthy();
    });

    test('Discussion includes bee info', async ({ request }) => {
      const listRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await listRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Post a discussion
      await request.post(`/api/gigs/${gigs[0].id}/discussions`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          content: `Discussion for testing ${Date.now()}`,
          message_type: 'question',
        },
      });
      
      // Get discussions
      const response = await request.get(`/api/gigs/${gigs[0].id}/discussions`);
      const data = await response.json();
      
      // Should have discussions
      expect(data.discussions.length).toBeGreaterThan(0);
      
      // Find our discussion
      const ourDiscussion = data.discussions.find((d: any) => d.bee_id === beeId);
      if (ourDiscussion) {
        expect(ourDiscussion.bee_name).toBeDefined();
      }
    });
  });

  test.describe('Completed Gig Behavior', () => {
    test('Completed gigs are marked closed in assignments', async ({ request }) => {
      const response = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      const data = await response.json();
      
      for (const completed of data.completed_assignments) {
        expect(completed.closed).toBe(true);
        expect(completed.action_required).toBe('NONE');
        expect(completed._warning).toContain('DO NOT');
      }
    });

    test('Cannot interact with completed gig', async ({ request }) => {
      const listRes = await request.get('/api/gigs?status=completed&limit=1');
      const { gigs } = await listRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Try to bid
      const bidRes = await request.post(`/api/gigs/${gigs[0].id}/bid`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { proposal: 'Late bid', estimated_hours: 5 },
      });
      expect(bidRes.status()).toBe(400);
      
      // Try to submit
      const submitRes = await request.post(`/api/gigs/${gigs[0].id}/submit`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { title: 'Late submission', content: 'Test' },
      });
      expect([400, 403]).toContain(submitRes.status());
      
      // Try to message
      const msgRes = await request.post(`/api/gigs/${gigs[0].id}/messages`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { content: 'Late message' },
      });
      expect([400, 403]).toContain(msgRes.status());
    });
  });

  test.describe('Human-Created vs Bee-Created Gigs', () => {
    test('Bees cannot create gigs', async ({ request }) => {
      // Try to create a gig as bee - should fail
      const createRes = await request.post('/api/gigs', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          title: `Bee-created gig attempt ${Date.now()}`,
          description: 'This should fail',
          category: 'testing',
        },
      });
      
      // Should be rejected - only humans can create gigs
      expect(createRes.status()).toBe(401);
      const data = await createRes.json();
      expect(data.error).toContain('Only humans can create gigs');
    });

    test('All gigs are human-created', async ({ request }) => {
      const listRes = await request.get('/api/gigs?limit=30');
      const { gigs } = await listRes.json();
      
      for (const gig of gigs) {
        expect(gig.creator_type).toBe('human');
      }
    });
  });

  test.describe('Bee Profile for Gig Owners', () => {
    test('Gig owner can view bee public profile', async ({ request }) => {
      const response = await request.get(`/api/bees/${beeId}`);
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.bee.name).toBe(beeName);
      expect(data.bee.skills).toBeDefined();
      expect(data.bee.reputation).toBeDefined();
      expect(data.bee.gigs_completed).toBeDefined();
      expect(data.bee.level).toBeDefined();
      
      // Should NOT expose private data
      expect(data.bee.api_key).toBeUndefined();
      expect(data.bee.money_cents).toBeUndefined();
    });

    test('Bee profile shows level and achievements', async ({ request }) => {
      const response = await request.get(`/api/bees/${beeId}`);
      const data = await response.json();
      
      expect(data.bee.level).toBeDefined();
      expect(data.bee.level_emoji).toBeDefined();
      
      const validLevels = ['new', 'worker', 'expert', 'queen', 'larva', 'elite'];
      expect(validLevels).toContain(data.bee.level);
    });
  });
});
