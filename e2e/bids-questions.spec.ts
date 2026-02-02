import { test, expect } from '@playwright/test';

test.describe('Bids as Comments/Questions System', () => {
  const testBees: { id: string; api_key: string; name: string }[] = [];
  
  test.afterAll(async ({ request }) => {
    // Clean up test bees
    for (const bee of testBees) {
      try {
        await request.delete('/api/bees/unregister', {
          headers: { 'Authorization': `Bearer ${bee.api_key}` },
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  test.describe('Bid Creation', () => {
    let testBeeApiKey: string;

    test.beforeAll(async ({ request }) => {
      // Register a test bee
      const beeName = `BidTestBee_${Date.now()}`;
      const res = await request.post('/api/bees/register', {
        data: { name: beeName, skills: ['testing'] },
      });
      const data = await res.json();
      testBeeApiKey = data.bee.api_key;
      testBees.push({ id: data.bee.id, api_key: testBeeApiKey, name: beeName });
    });

    test('can place a question (honey_requested = 0)', async ({ request }) => {
      // Get an open gig
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const gigsData = await gigsRes.json();
      
      if (!gigsData.gigs || gigsData.gigs.length === 0) {
        test.skip();
        return;
      }
      
      const gig = gigsData.gigs[0];
      
      // Create a fresh bee to avoid "already bid" errors
      const freshBeeName = `QuestionBee_${Date.now()}`;
      const freshBeeRes = await request.post('/api/bees/register', {
        data: { name: freshBeeName, skills: ['testing'] },
      });
      const freshBeeData = await freshBeeRes.json();
      testBees.push({ id: freshBeeData.bee.id, api_key: freshBeeData.bee.api_key, name: freshBeeName });
      
      // Place a question (honey_requested = 0)
      const bidRes = await request.post(`/api/gigs/${gig.id}/bid`, {
        headers: { 'Authorization': `Bearer ${freshBeeData.bee.api_key}` },
        data: {
          proposal: 'What framework is this built with? I need to know before bidding.',
          honey_requested: 0,
        },
      });
      
      expect(bidRes.ok()).toBeTruthy();
      const bidData = await bidRes.json();
      
      expect(bidData.success).toBe(true);
      expect(bidData.type).toBe('question');
      expect(bidData.bid.honey_requested).toBe(0);
    });

    test('can place a bid with honey_requested', async ({ request }) => {
      // Get an open gig
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const gigsData = await gigsRes.json();
      
      if (!gigsData.gigs || gigsData.gigs.length === 0) {
        test.skip();
        return;
      }
      
      const gig = gigsData.gigs[0];
      
      // Create a fresh bee
      const freshBeeName = `BiddingBee_${Date.now()}`;
      const freshBeeRes = await request.post('/api/bees/register', {
        data: { name: freshBeeName, skills: ['testing'] },
      });
      const freshBeeData = await freshBeeRes.json();
      testBees.push({ id: freshBeeData.bee.id, api_key: freshBeeData.bee.api_key, name: freshBeeName });
      
      const honeyToBid = Math.min(gig.honey_reward || 100, 200);
      
      const bidRes = await request.post(`/api/gigs/${gig.id}/bid`, {
        headers: { 'Authorization': `Bearer ${freshBeeData.bee.api_key}` },
        data: {
          proposal: 'I can complete this work efficiently with high quality.',
          honey_requested: honeyToBid,
          estimated_hours: 5,
        },
      });
      
      expect(bidRes.ok()).toBeTruthy();
      const bidData = await bidRes.json();
      
      expect(bidData.success).toBe(true);
      expect(bidData.type).toBe('bid');
      expect(bidData.bid.honey_requested).toBe(honeyToBid);
    });
  });

  test.describe('Bid Updates', () => {
    test('can update existing bid with PUT', async ({ request }) => {
      // Get an open gig
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const gigsData = await gigsRes.json();
      
      if (!gigsData.gigs || gigsData.gigs.length === 0) {
        test.skip();
        return;
      }
      
      const gig = gigsData.gigs[0];
      
      // Create a fresh bee
      const freshBeeName = `UpdateBee_${Date.now()}`;
      const freshBeeRes = await request.post('/api/bees/register', {
        data: { name: freshBeeName, skills: ['testing'] },
      });
      const freshBeeData = await freshBeeRes.json();
      testBees.push({ id: freshBeeData.bee.id, api_key: freshBeeData.bee.api_key, name: freshBeeName });
      
      // First, place a question
      const bidRes = await request.post(`/api/gigs/${gig.id}/bid`, {
        headers: { 'Authorization': `Bearer ${freshBeeData.bee.api_key}` },
        data: {
          proposal: 'Initial question about the project scope and timeline...',
          honey_requested: 0,
        },
      });
      
      // Handle rate limit - skip if we hit it
      if (bidRes.status() === 429) {
        test.skip();
        return;
      }
      expect(bidRes.ok()).toBeTruthy();
      
      // Now update the bid with a price
      const updateRes = await request.put(`/api/gigs/${gig.id}/bid`, {
        headers: { 'Authorization': `Bearer ${freshBeeData.bee.api_key}` },
        data: {
          proposal: 'Updated: After reviewing the requirements, I can complete this efficiently.',
          honey_requested: Math.min(gig.honey_reward || 100, 150),
        },
      });
      
      // Log error for debugging if it fails
      if (!updateRes.ok()) {
        const errData = await updateRes.json();
        console.log('PUT bid error:', updateRes.status(), errData);
      }
      
      expect(updateRes.ok()).toBeTruthy();
      const updateData = await updateRes.json();
      expect(updateData.success).toBe(true);
    });

    test('cannot update non-existent bid', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const gigsData = await gigsRes.json();
      
      if (!gigsData.gigs || gigsData.gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Create a fresh bee that hasn't bid
      const freshBeeName = `NoBidBee_${Date.now()}`;
      const freshBeeRes = await request.post('/api/bees/register', {
        data: { name: freshBeeName, skills: ['testing'] },
      });
      const freshBeeData = await freshBeeRes.json();
      testBees.push({ id: freshBeeData.bee.id, api_key: freshBeeData.bee.api_key, name: freshBeeName });
      
      // Try to update without having a bid
      const updateRes = await request.put(`/api/gigs/${gigsData.gigs[0].id}/bid`, {
        headers: { 'Authorization': `Bearer ${freshBeeData.bee.api_key}` },
        data: {
          honey_requested: 100,
        },
      });
      
      expect(updateRes.status()).toBe(404);
    });
  });

  test.describe('Bid Privacy', () => {
    test('bid prices hidden from public', async ({ request }) => {
      // Get a gig with bids
      const gigsRes = await request.get('/api/gigs?status=open&limit=10');
      const gigsData = await gigsRes.json();
      
      // Find a gig that likely has bids
      for (const gig of gigsData.gigs || []) {
        if (gig.bid_count > 0) {
          // Get gig details without auth (public)
          const detailRes = await request.get(`/api/gigs/${gig.id}`);
          const detailData = await detailRes.json();
          
          // Check that bids don't have honey_requested visible
          for (const bid of detailData.bids || []) {
            expect(bid.honey_requested).toBeUndefined();
          }
          return;
        }
      }
      
      // No gigs with bids found, skip
      test.skip();
    });

    test('bid prices visible to gig owner', async ({ request, page }) => {
      // This would require human auth which is complex to test
      // Skip for now - manual verification needed
      test.skip();
    });
  });

  test.describe('Discussions Removed', () => {
    test('discussions endpoint returns empty', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const gigsData = await gigsRes.json();
      
      if (!gigsData.gigs || gigsData.gigs.length === 0) {
        test.skip();
        return;
      }
      
      const discussionsRes = await request.get(`/api/gigs/${gigsData.gigs[0].id}/discussions`);
      const discussionsData = await discussionsRes.json();
      
      expect(discussionsData.discussions).toEqual([]);
    });

    test('posting to discussions returns 410 Gone', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const gigsData = await gigsRes.json();
      
      if (!gigsData.gigs || gigsData.gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Create a test bee
      const beeName = `DiscussionTestBee_${Date.now()}`;
      const beeRes = await request.post('/api/bees/register', {
        data: { name: beeName, skills: ['testing'] },
      });
      const beeData = await beeRes.json();
      testBees.push({ id: beeData.bee.id, api_key: beeData.bee.api_key, name: beeName });
      
      const postRes = await request.post(`/api/gigs/${gigsData.gigs[0].id}/discussions`, {
        headers: { 'Authorization': `Bearer ${beeData.bee.api_key}` },
        data: { content: 'Test discussion' },
      });
      
      expect(postRes.status()).toBe(410);
    });
  });

  test.describe('Homepage Display', () => {
    test('gigs show bid count', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=5');
      const gigsData = await gigsRes.json();
      
      for (const gig of gigsData.gigs || []) {
        expect(gig).toHaveProperty('bid_count');
        expect(typeof gig.bid_count).toBe('number');
      }
    });
  });
});
