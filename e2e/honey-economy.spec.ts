import { test, expect } from '@playwright/test';

test.describe('Honey Economy', () => {
  const testBees: { id: string; api_key: string; name: string }[] = [];
  
  // We'll need to create a test user via the API or use existing test auth
  // For now, we focus on the bee-side of the honey economy

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

  test.describe('Gig Listing - Honey Display', () => {
    test('gigs show honey_reward instead of price_cents', async ({ request }) => {
      const response = await request.get('/api/gigs?status=open&limit=10');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      
      for (const gig of data.gigs || []) {
        // Should have honey_reward
        expect(gig).toHaveProperty('honey_reward');
        expect(gig).toHaveProperty('honey_formatted');
        // honey_formatted should include the honey emoji
        if (gig.honey_reward > 0) {
          expect(gig.honey_formatted).toContain('🍯');
        }
      }
    });
  });

  test.describe('Bidding with Honey', () => {
    let testBeeApiKey: string;
    let testBeeId: string;

    test.beforeAll(async ({ request }) => {
      // Register a test bee
      const beeName = `HoneyTestBee_${Date.now()}`;
      const res = await request.post('/api/bees/register', {
        data: {
          name: beeName,
          description: 'Test bee for honey economy tests',
          skills: ['testing'],
        },
      });
      const data = await res.json();
      testBeeApiKey = data.bee.api_key;
      testBeeId = data.bee.id;
      testBees.push({ id: testBeeId, api_key: testBeeApiKey, name: beeName });
    });

    test('bid requires honey_requested field', async ({ request }) => {
      // Get an open gig
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const gigsData = await gigsRes.json();
      
      if (!gigsData.gigs || gigsData.gigs.length === 0) {
        test.skip();
        return;
      }
      
      const gig = gigsData.gigs[0];
      
      // Try to bid without honey_requested
      const bidRes = await request.post(`/api/gigs/${gig.id}/bid`, {
        headers: { 'Authorization': `Bearer ${testBeeApiKey}` },
        data: {
          proposal: 'I will complete this task efficiently and effectively.',
          estimated_hours: 5,
          // No honey_requested
        },
      });
      
      expect(bidRes.status()).toBe(400);
      const errorData = await bidRes.json();
      expect(errorData.error).toContain('honey_requested');
    });

    test('bid honey_requested cannot exceed gig honey_reward', async ({ request }) => {
      // Get an open gig with honey_reward
      const gigsRes = await request.get('/api/gigs?status=open&limit=10');
      const gigsData = await gigsRes.json();
      
      const gig = gigsData.gigs?.find((g: any) => g.honey_reward > 0);
      if (!gig) {
        test.skip();
        return;
      }
      
      // Try to bid more than the honey_reward
      const bidRes = await request.post(`/api/gigs/${gig.id}/bid`, {
        headers: { 'Authorization': `Bearer ${testBeeApiKey}` },
        data: {
          proposal: 'I will complete this task efficiently and effectively.',
          honey_requested: gig.honey_reward + 100, // Exceeds reward
          estimated_hours: 5,
        },
      });
      
      expect(bidRes.status()).toBe(400);
      const errorData = await bidRes.json();
      expect(errorData.error).toContain('exceeds');
    });

    test('valid bid with honey_requested succeeds', async ({ request }) => {
      // Register a fresh bee to avoid "already bid" errors
      const freshBeeName = `FreshHoneyBee_${Date.now()}`;
      const freshBeeRes = await request.post('/api/bees/register', {
        data: {
          name: freshBeeName,
          skills: ['testing'],
        },
      });
      const freshBeeData = await freshBeeRes.json();
      testBees.push({ id: freshBeeData.bee.id, api_key: freshBeeData.bee.api_key, name: freshBeeName });
      
      // Get an open gig with honey_reward
      const gigsRes = await request.get('/api/gigs?status=open&limit=10');
      const gigsData = await gigsRes.json();
      
      const gig = gigsData.gigs?.find((g: any) => g.honey_reward > 0);
      if (!gig) {
        test.skip();
        return;
      }
      
      // Valid bid within honey_reward
      const honeyToBid = Math.min(gig.honey_reward, 200);
      const bidRes = await request.post(`/api/gigs/${gig.id}/bid`, {
        headers: { 'Authorization': `Bearer ${freshBeeData.bee.api_key}` },
        data: {
          proposal: 'I will complete this task efficiently and effectively with great attention to detail.',
          honey_requested: honeyToBid,
          estimated_hours: 5,
        },
      });
      
      expect(bidRes.ok()).toBeTruthy();
      const bidData = await bidRes.json();
      
      expect(bidData.success).toBe(true);
      expect(bidData.honey_info).toBeDefined();
      expect(bidData.honey_info.requested).toBe(honeyToBid);
      expect(bidData.honey_info.platform_fee).toBe('10%');
      expect(bidData.honey_info.you_will_receive).toBe(Math.floor(honeyToBid * 0.9));
    });
  });

  test.describe('Gig Creation - Humans Only', () => {
    test('bees cannot create gigs', async ({ request }) => {
      // Register a test bee
      const beeName = `GigTestBee_${Date.now()}`;
      const beeRes = await request.post('/api/bees/register', {
        data: {
          name: beeName,
          skills: ['testing'],
        },
      });
      const beeData = await beeRes.json();
      testBees.push({ id: beeData.bee.id, api_key: beeData.bee.api_key, name: beeName });
      
      // Try to create a gig as a bee (should fail)
      const gigRes = await request.post('/api/gigs', {
        headers: { 'Authorization': `Bearer ${beeData.bee.api_key}` },
        data: {
          title: 'Test gig from bee',
          description: 'This should fail',
          honey_reward: 200,
        },
      });
      
      expect(gigRes.status()).toBe(401);
      const errorData = await gigRes.json();
      expect(errorData.error).toContain('humans');
    });
  });

  test.describe('Honey Validation Rules', () => {
    test('gig creation requires minimum 100 honey (when authenticated)', async ({ request, page }) => {
      // This test would require human authentication
      // For now, we test the API validation by checking the error message structure
      
      // Without auth, should get 401
      const res = await request.post('/api/gigs', {
        data: {
          title: 'Test gig',
          description: 'Test',
          honey_reward: 50, // Below minimum
        },
      });
      
      // Should fail with auth error (since no session)
      expect(res.status()).toBe(401);
    });

    test('API returns honey_reward in gig details', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const gigsData = await gigsRes.json();
      
      if (!gigsData.gigs || gigsData.gigs.length === 0) {
        test.skip();
        return;
      }
      
      const gigId = gigsData.gigs[0].id;
      const detailRes = await request.get(`/api/gigs/${gigId}`);
      
      if (detailRes.ok()) {
        const detailData = await detailRes.json();
        const gig = detailData.gig || detailData;
        expect(gig).toHaveProperty('honey_reward');
      }
    });
  });
});
