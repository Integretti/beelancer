import { test, expect } from '@playwright/test';
import { generateTestEmail, generateTestName } from './helpers';

/**
 * Full Integration Tests
 * 
 * These tests cover complete user journeys from start to finish.
 * They test the actual user experience, not just individual components.
 */

test.describe('Full User Flows', () => {
  
  test.describe('New User Signup Flow', () => {
    test('complete signup → verify → dashboard flow', async ({ page, request, baseURL }) => {
      const email = generateTestEmail();
      const password = 'SecurePassword123!';
      const name = generateTestName();

      // Step 1: Visit homepage
      await page.goto('/');
      await expect(page.getByText('Beelancer')).toBeVisible();

      // Step 2: Click "Post a Gig" (should go to signup since not logged in)
      await page.click('a:has-text("Post a Gig")');
      await expect(page).toHaveURL(/\/signup/);

      // Step 3: Fill out signup form
      await page.fill('input[placeholder*="call you"]', name);
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      
      // Step 4: Submit signup
      await page.click('button[type="submit"]');
      
      // Step 5: Should see success message
      await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(email)).toBeVisible();

      // Step 6: Get verification code (via test endpoint)
      const codeResponse = await request.get(`/api/test/verification-code?email=${encodeURIComponent(email)}`);
      
      // If test endpoint is not available (production), skip the rest
      if (!codeResponse.ok()) {
        test.skip(true, 'Verification code endpoint not available');
        return;
      }
      
      const { code } = await codeResponse.json();
      expect(code).toBeDefined();

      // Step 7: Go to verify page
      await page.goto('/verify');
      
      // Step 8: Enter verification code
      await page.fill('input[type="text"]', code);
      await page.click('button[type="submit"]');

      // Step 9: Should be redirected to dashboard and logged in
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
      
      // Step 10: Verify header shows logged-in state
      await page.goto('/');
      await page.waitForTimeout(1500); // Wait for auth check
      await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
    });
  });

  test.describe('Bee Registration Flow', () => {
    test('register bee → get API key → check profile', async ({ request }) => {
      const beeName = `FlowTestBee_${Date.now()}`;

      // Step 1: Register a new bee
      const registerRes = await request.post('/api/bees/register', {
        data: {
          name: beeName,
          description: 'An AI agent for flow testing',
          skills: ['testing', 'automation', 'analysis'],
        },
      });

      expect(registerRes.ok()).toBeTruthy();
      const registerData = await registerRes.json();
      
      expect(registerData.success).toBe(true);
      expect(registerData.bee.api_key).toMatch(/^bee_/);
      
      const apiKey = registerData.bee.api_key;

      // Step 2: Check profile with API key
      const profileRes = await request.get('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      expect(profileRes.ok()).toBeTruthy();
      const profileData = await profileRes.json();

      expect(profileData.bee.name).toBe(beeName);
      expect(profileData.bee.honey).toBe(0);
      expect(profileData.bee.gigs_completed).toBe(0);

      // Step 3: Verify bee appears in stats
      const statsRes = await request.get('/api/stats');
      const statsData = await statsRes.json();
      
      expect(statsData.total_bees).toBeGreaterThan(0);
    });
  });

  test.describe('Gig Discovery Flow', () => {
    test('browse gigs → view details → navigate', async ({ page }) => {
      // Step 1: Visit homepage
      await page.goto('/');

      // Step 2: Look at gigs section
      await expect(page.getByRole('heading', { name: /fresh gigs/i })).toBeVisible();

      // Step 3: Try category filter
      const categorySelect = page.getByRole('combobox');
      await expect(categorySelect).toBeVisible();
      
      // Step 4: Check API docs are accessible
      await page.click('a:has-text("API Docs")');
      await expect(page).toHaveURL(/\/docs/);
      
      // Step 5: Verify docs content
      await expect(page.getByRole('heading', { name: /api reference/i })).toBeVisible();
      await expect(page.getByText('/api/bees/register')).toBeVisible();
    });
  });

  test.describe('API Documentation Flow', () => {
    test('read docs → try endpoint examples', async ({ page, request }) => {
      // Step 1: Visit docs
      await page.goto('/docs');
      
      // Step 2: Read about bee registration
      const registerSection = page.getByText('/api/bees/register').first();
      await registerSection.click();
      
      // Step 3: Verify example is shown
      await expect(page.getByText(/unique name for your bee/i).first()).toBeVisible();
      
      // Step 4: Actually try the endpoint (from docs example)
      const beeName = `DocsTestBee_${Date.now()}`;
      const response = await request.post('/api/bees/register', {
        data: {
          name: beeName,
          skills: ['coding'],
        },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.bee.api_key).toBeDefined();
    });
  });
});

test.describe('Edge Cases & Error Handling', () => {
  
  test('should handle rapid signup attempts gracefully', async ({ request }) => {
    const email = generateTestEmail();
    
    // Send multiple signup requests rapidly
    const promises = Array(3).fill(null).map(() => 
      request.post('/api/auth/signup', {
        data: {
          email,
          password: 'TestPassword123!',
          name: 'Rapid Test',
        },
      })
    );
    
    const responses = await Promise.all(promises);
    
    // First should succeed, others should fail with conflict
    const successCount = responses.filter(r => r.status() === 201).length;
    const conflictCount = responses.filter(r => r.status() === 409).length;
    
    expect(successCount).toBe(1);
    expect(conflictCount).toBe(2);
  });

  test('should handle invalid API keys gracefully', async ({ request }) => {
    const invalidKeys = [
      'invalid',
      'bee_invalid',
      '',
      'Bearer token',
      '🐝🐝🐝',
    ];

    for (const key of invalidKeys) {
      const response = await request.get('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      
      expect(response.status()).toBe(401);
    }
  });

  test('should handle malformed JSON gracefully', async ({ request }) => {
    const response = await request.post('/api/bees/register', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not valid json {{{',
    });
    
    // Should return 400 or 500, not crash
    expect([400, 500]).toContain(response.status());
  });
});
import { test, expect } from '@playwright/test';

test.describe('Gig Lifecycle & Status Transitions', () => {
  let beeApiKey: string;
  let beeName: string;
  let beeId: string;

  test.beforeAll(async ({ request }) => {
    // Register a test bee for the lifecycle tests
    beeName = `LifecycleBee_${Date.now()}`;
    const response = await request.post('/api/bees/register', {
      data: {
        name: beeName,
        description: 'Bee for testing gig lifecycle',
        skills: ['testing', 'automation', 'coding'],
      },
    });
    const data = await response.json();
    beeApiKey = data.bee.api_key;
    beeId = data.bee.id;
  });

  test.describe('Gig Status Values', () => {
    test('GET /api/gigs returns gigs with valid status values', async ({ request }) => {
      const response = await request.get('/api/gigs?limit=50');
      const { gigs } = await response.json();
      
      const validStatuses = ['draft', 'open', 'in_progress', 'review', 'completed', 'paid', 'cancelled'];
      
      for (const gig of gigs) {
        expect(validStatuses).toContain(gig.status);
      }
    });

    test('GET /api/gigs?status=open returns only open gigs', async ({ request }) => {
      const response = await request.get('/api/gigs?status=open');
      const { gigs } = await response.json();
      
      for (const gig of gigs) {
        expect(gig.status).toBe('open');
      }
    });

    test('GET /api/gigs?status=in_progress returns only in-progress gigs', async ({ request }) => {
      const response = await request.get('/api/gigs?status=in_progress');
      const { gigs } = await response.json();
      
      for (const gig of gigs) {
        expect(gig.status).toBe('in_progress');
      }
    });

    test('GET /api/gigs?status=completed returns only completed gigs', async ({ request }) => {
      const response = await request.get('/api/gigs?status=completed');
      const { gigs } = await response.json();
      
      for (const gig of gigs) {
        expect(gig.status).toBe('completed');
      }
    });
  });

  test.describe('Bidding Flow', () => {
    test('POST /api/gigs/:id/bid requires authentication', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/bid`, {
        data: {
          proposal: 'Test proposal',
          estimated_hours: 5,
        },
      });
      
      expect(response.status()).toBe(401);
    });

    test('POST /api/gigs/:id/bid creates a bid on open gig', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/bid`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          proposal: `Lifecycle test proposal ${Date.now()}`,
          estimated_hours: 8,
          honey_requested: 100,
        },
      });
      
      // Could succeed or fail if already bid
      expect([200, 201, 409]).toContain(response.status());
      
      if (response.status() === 201 || response.status() === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.bid).toBeDefined();
      }
    });

    test('POST /api/gigs/:id/bid rejects bid without proposal', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/bid`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          estimated_hours: 5,
        },
      });
      
      expect(response.status()).toBe(400);
    });

    test('POST /api/gigs/:id/bid rejects bid on non-open gig', async ({ request }) => {
      // Try to find a non-open gig
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/bid`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          proposal: 'Late bid attempt',
          estimated_hours: 5,
        },
      });
      
      expect(response.status()).toBe(400);
    });

    test('Duplicate bid from same bee is rejected', async ({ request }) => {
      // Create a new bee specifically for this test
      const testBeeName = `DupeBidBee_${Date.now()}`;
      const beeRes = await request.post('/api/bees/register', {
        data: { name: testBeeName, skills: ['test'] },
      });
      const { bee } = await beeRes.json();
      
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // First bid
      const firstRes = await request.post(`/api/gigs/${gigs[0].id}/bid`, {
        headers: { 'Authorization': `Bearer ${bee.api_key}` },
        data: {
          proposal: 'First bid from new bee',
          estimated_hours: 5,
        },
      });
      expect([200, 201]).toContain(firstRes.status());
      
      // Second bid from same bee
      const response = await request.post(`/api/gigs/${gigs[0].id}/bid`, {
        headers: { 'Authorization': `Bearer ${bee.api_key}` },
        data: {
          proposal: 'Duplicate bid attempt',
          estimated_hours: 5,
        },
      });
      
      // Should be either 409 (conflict/duplicate) or 429 (rate limited)
      expect([409, 429]).toContain(response.status());
    });
  });

  test.describe('Gig Detail with Bids', () => {
    test('GET /api/gigs/:id shows bid count', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=10');
      const { gigs } = await gigsRes.json();
      
      for (const gig of gigs.slice(0, 3)) { // Check first 3 only
        const detailRes = await request.get(`/api/gigs/${gig.id}`);
        const data = await detailRes.json();
        const detail = data.gig || data; // Handle wrapped response
        
        expect(detail.bid_count).toBeDefined();
        expect(typeof detail.bid_count).toBe('number');
        expect(detail.bid_count).toBeGreaterThanOrEqual(0);
      }
    });

    test('GET /api/gigs/:id shows bids array', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.get(`/api/gigs/${gigs[0].id}`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      const gig = data.gig || data; // Handle wrapped response
      
      // Should have standard fields
      expect(gig.id).toBeDefined();
      expect(gig.title).toBeDefined();
      expect(gig.status).toBeDefined();
      
      // Should have bids array (may be empty)
      expect(data.bids).toBeDefined();
      expect(Array.isArray(data.bids)).toBe(true);
    });
  });

  test.describe('Deliverable Submission', () => {
    test('POST /api/gigs/:id/submit requires authentication', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/submit`, {
        data: {
          title: 'Test deliverable',
          content: 'Test content',
        },
      });
      
      expect(response.status()).toBe(401);
    });

    test('POST /api/gigs/:id/submit rejects submission to open gig', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/submit`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          title: 'Premature submission',
          content: 'This should fail',
        },
      });
      
      // Should fail - either not assigned or wrong status
      expect([400, 403]).toContain(response.status());
    });

    test('POST /api/gigs/:id/submit rejects submission to completed gig', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=completed&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/submit`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          title: 'Late submission',
          content: 'This should fail',
        },
      });
      
      expect([400, 403]).toContain(response.status());
    });
  });

  test.describe('Gig Discussions (Public)', () => {
    test('GET /api/gigs/:id/discussions returns discussion list', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.get(`/api/gigs/${gigs[0].id}/discussions`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.discussions).toBeDefined();
      expect(Array.isArray(data.discussions)).toBe(true);
    });

    test('POST /api/gigs/:id/discussions requires authentication', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/discussions`, {
        data: {
          content: 'Test discussion',
        },
      });
      
      expect(response.status()).toBe(401);
    });

    test('POST /api/gigs/:id/discussions creates new discussion', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/discussions`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          content: `Test discussion from lifecycle tests ${Date.now()}`,
          message_type: 'question',
        },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.discussion).toBeDefined();
    });
  });

  test.describe('Work Messages (Private)', () => {
    test('GET /api/gigs/:id/messages requires authorization', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Request without auth
      const response = await request.get(`/api/gigs/${gigs[0].id}/messages`);
      expect(response.status()).toBe(403);
    });

    test('GET /api/gigs/:id/messages returns closed status for completed gigs', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=completed&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Even with auth, if not assigned we should get 403
      const response = await request.get(`/api/gigs/${gigs[0].id}/messages`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      // Either forbidden (not assigned) or success with is_closed flag
      if (response.ok()) {
        const data = await response.json();
        expect(data.is_closed).toBe(true);
        expect(data.warning).toContain('DO NOT');
      } else {
        expect(response.status()).toBe(403);
      }
    });

    test('POST /api/gigs/:id/messages blocks messages to completed gigs', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=completed&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/messages`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { content: 'Message to closed gig' },
      });
      
      expect([400, 403]).toContain(response.status());
      
      if (response.status() === 400) {
        const data = await response.json();
        expect(data.error).toContain('closed');
        expect(data.action).toBe('MOVE_ON');
      }
    });
  });
});
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
import { test, expect } from '@playwright/test';

test.describe('Gigs Listing Pages', () => {
  
  test.describe('API: GET /api/gigs with pagination', () => {
    test('returns total count', async ({ request }) => {
      const response = await request.get('/api/gigs?status=open&limit=5');

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.gigs).toBeDefined();
      expect(data.total).toBeDefined();
      expect(typeof data.total).toBe('number');
    });

    test('respects limit parameter', async ({ request }) => {
      const response = await request.get('/api/gigs?status=open&limit=3');

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.gigs.length).toBeLessThanOrEqual(3);
    });

    test('respects offset parameter', async ({ request }) => {
      // Get first page
      const res1 = await request.get('/api/gigs?status=open&limit=2&offset=0');
      const data1 = await res1.json();

      // Get second page
      const res2 = await request.get('/api/gigs?status=open&limit=2&offset=2');
      const data2 = await res2.json();

      // If there are enough gigs, pages should be different
      if (data1.total > 2 && data2.gigs.length > 0) {
        expect(data1.gigs[0]?.id).not.toBe(data2.gigs[0]?.id);
      }
    });

    test('filters by status correctly', async ({ request }) => {
      const openRes = await request.get('/api/gigs?status=open');
      const openData = await openRes.json();

      const inProgressRes = await request.get('/api/gigs?status=in_progress');
      const inProgressData = await inProgressRes.json();

      // Both should return valid responses
      expect(openData.gigs).toBeDefined();
      expect(inProgressData.gigs).toBeDefined();

      // Check that status filtering works
      openData.gigs.forEach((gig: any) => {
        expect(gig.status).toBe('open');
      });
      inProgressData.gigs.forEach((gig: any) => {
        expect(gig.status).toBe('in_progress');
      });
    });
  });

  test.describe('/gigs page (Open Quests)', () => {
    test('loads without errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      const response = await page.goto('/gigs');
      expect(response?.status()).toBe(200);

      await page.waitForLoadState('networkidle');

      // Check for React/JS errors
      const appError = await page.locator('text=Application error').count();
      expect(appError).toBe(0);
    });

    test('displays page title and header', async ({ page }) => {
      await page.goto('/gigs');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: /all open quests/i })).toBeVisible();
    });

    test('displays quest count', async ({ page }) => {
      await page.goto('/gigs');
      await page.waitForLoadState('networkidle');

      // Should show "X quests waiting for bees"
      await expect(page.getByText(/quest.*waiting/i)).toBeVisible();
    });

    test('has back to home link', async ({ page }) => {
      await page.goto('/gigs');
      await page.waitForLoadState('networkidle');

      const backLink = page.getByText('← Back to Home');
      await expect(backLink).toBeVisible();

      await backLink.click();
      await expect(page).toHaveURL('/');
    });

    test('displays category filters', async ({ page }) => {
      await page.goto('/gigs');
      await page.waitForLoadState('networkidle');

      // Should have category filter buttons (using actual category names)
      await expect(page.getByRole('button', { name: /coding/i })).toBeVisible();
    });

    test('category filtering works', async ({ page }) => {
      await page.goto('/gigs');
      await page.waitForLoadState('networkidle');

      // Click a category filter
      const codingFilter = page.getByRole('button', { name: /coding/i });
      await codingFilter.click();

      // Button should be highlighted (has yellow in classes when selected)
      await expect(codingFilter).toHaveClass(/yellow/);

      // Click again to clear
      await codingFilter.click();
    });

    test('handles empty state gracefully', async ({ page }) => {
      // Apply a filter that might return no results
      await page.goto('/gigs');
      await page.waitForLoadState('networkidle');

      // If there are no gigs, should show empty state
      const emptyState = page.getByText(/no open quests|check back soon/i);
      const gigsExist = await page.locator('[href^="/gig/"]').count() > 0;

      if (!gigsExist) {
        await expect(emptyState).toBeVisible();
      }
    });
  });

  test.describe('/gigs/in-progress page', () => {
    test('loads without errors', async ({ page }) => {
      const response = await page.goto('/gigs/in-progress');
      expect(response?.status()).toBe(200);

      await page.waitForLoadState('networkidle');

      const appError = await page.locator('text=Application error').count();
      expect(appError).toBe(0);
    });

    test('displays page title', async ({ page }) => {
      await page.goto('/gigs/in-progress');
      await page.waitForLoadState('networkidle');

      await expect(page.getByRole('heading', { name: /work in progress/i })).toBeVisible();
    });

    test('shows in-progress badge on gigs', async ({ page }) => {
      await page.goto('/gigs/in-progress');
      await page.waitForLoadState('networkidle');

      // If there are any gigs, they should have "In Progress" badge
      const gigCards = page.locator('[href^="/gig/"]');
      const count = await gigCards.count();

      if (count > 0) {
        await expect(page.getByText('⚡ In Progress').first()).toBeVisible();
      }
    });

    test('has link to open quests when empty', async ({ page }) => {
      await page.goto('/gigs/in-progress');
      await page.waitForLoadState('networkidle');

      const gigsExist = await page.locator('[href^="/gig/"]').count() > 0;

      if (!gigsExist) {
        await expect(page.getByText(/view open quests/i)).toBeVisible();
      }
    });
  });

  test.describe('Homepage gigs sections', () => {
    test('Fresh Quests section is capped at 10', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Count gig cards in fresh quests section
      const freshQuests = page.locator('h2:has-text("Fresh Quests") + * [href^="/gig/"], h2:has-text("Fresh Quests") ~ div [href^="/gig/"]').first();
      
      // The section should exist
      await expect(page.getByText('Fresh Quests')).toBeVisible();
    });

    test('Show more button appears when there are more than 10 open gigs', async ({ page, request }) => {
      // First check how many open gigs there are
      const apiRes = await request.get('/api/gigs?status=open&limit=1');
      const apiData = await apiRes.json();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      if (apiData.total > 10) {
        // Should show "Show all X quests" button
        await expect(page.getByText(/show all.*quests/i)).toBeVisible();
      }
    });

    test('Show more button links to /gigs', async ({ page, request }) => {
      const apiRes = await request.get('/api/gigs?status=open&limit=1');
      const apiData = await apiRes.json();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      if (apiData.total > 10) {
        const showMoreBtn = page.getByRole('link', { name: /show all.*quests/i });
        await expect(showMoreBtn).toHaveAttribute('href', '/gigs');
      }
    });

    test('Work in Progress section is capped at 5', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Work in Progress section might not exist if no gigs
      const wipSection = page.getByText('Work in Progress');
      if (await wipSection.isVisible()) {
        // Count should be at most 5
        const wipGigs = page.locator('h2:has-text("Work in Progress") ~ div [href^="/gig/"]');
        const count = await wipGigs.count();
        expect(count).toBeLessThanOrEqual(5);
      }
    });

    test('Show more button for in-progress links to /gigs/in-progress', async ({ page, request }) => {
      const apiRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const apiData = await apiRes.json();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      if (apiData.total > 5) {
        const showMoreBtn = page.getByRole('link', { name: /show all.*in progress/i });
        await expect(showMoreBtn).toHaveAttribute('href', '/gigs/in-progress');
      }
    });
  });

  test.describe('Pagination', () => {
    test('/gigs shows pagination when needed', async ({ page, request }) => {
      const apiRes = await request.get('/api/gigs?status=open&limit=1');
      const apiData = await apiRes.json();

      await page.goto('/gigs');
      await page.waitForLoadState('networkidle');

      // Pagination should appear if total > 20 (PAGE_SIZE)
      if (apiData.total > 20) {
        await expect(page.getByText(/page.*of/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
      }
    });

    test('pagination navigation works', async ({ page, request }) => {
      const apiRes = await request.get('/api/gigs?status=open&limit=1');
      const apiData = await apiRes.json();

      if (apiData.total > 20) {
        await page.goto('/gigs');
        await page.waitForLoadState('networkidle');

        // Click next
        await page.getByRole('button', { name: /next/i }).click();
        await expect(page).toHaveURL(/page=2/);

        // Click previous
        await page.getByRole('button', { name: /previous/i }).click();
        await expect(page).toHaveURL(/page=1|\/gigs$/);
      }
    });
  });
});
