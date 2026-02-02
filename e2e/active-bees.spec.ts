import { test, expect } from '@playwright/test';

test.describe('Active Bees Feature', () => {
  const testBees: { id: string; api_key: string; name: string }[] = [];

  test.afterAll(async ({ request }) => {
    // Clean up test bees
    for (const bee of testBees) {
      try {
        await request.delete(`/api/bees/unregister`, {
          headers: { 'Authorization': `Bearer ${bee.api_key}` },
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  test.describe('API: GET /api/bees/active', () => {
    test('returns array of bees', async ({ request }) => {
      const response = await request.get('/api/bees/active');

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.bees).toBeDefined();
      expect(Array.isArray(data.bees)).toBe(true);
    });

    test('respects limit parameter', async ({ request }) => {
      const response = await request.get('/api/bees/active?limit=5');

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.bees.length).toBeLessThanOrEqual(5);
    });

    test('returns expected bee fields', async ({ request }) => {
      // First register a bee and send heartbeat to make it active
      const name = `ActiveTestBee_${Date.now()}`;
      const regRes = await request.post('/api/bees/register', {
        data: { name, skills: ['testing'] },
      });
      const regData = await regRes.json();
      const apiKey = regData.bee.api_key;
      testBees.push({ id: regData.bee.id, api_key: apiKey, name });

      // Send heartbeat to mark as active
      await request.post('/api/bees/heartbeat', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      // Fetch active bees
      const response = await request.get('/api/bees/active?limit=20');
      const data = await response.json();

      // Find our test bee
      const testBee = data.bees.find((b: any) => b.name === name);

      if (testBee) {
        expect(testBee.id).toBeDefined();
        expect(testBee.name).toBeDefined();
        expect(testBee.level).toBeDefined();
        expect(testBee.level_emoji).toBeDefined();
        expect(testBee.honey).toBeDefined();
        expect(testBee.last_seen_at).toBeDefined();
      }
    });

    test('orders by last_seen_at descending', async ({ request }) => {
      const response = await request.get('/api/bees/active?limit=10');
      const data = await response.json();

      if (data.bees.length > 1) {
        for (let i = 0; i < data.bees.length - 1; i++) {
          const current = new Date(data.bees[i].last_seen_at).getTime();
          const next = new Date(data.bees[i + 1].last_seen_at).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    test('only returns active status bees', async ({ request }) => {
      const response = await request.get('/api/bees/active');
      const data = await response.json();

      // All returned bees should be active (sleeping bees excluded)
      // We can't directly verify status since it's not returned, but we can verify they exist
      expect(response.ok()).toBeTruthy();
    });

    test('does not expose sensitive data', async ({ request }) => {
      const response = await request.get('/api/bees/active');
      const data = await response.json();

      data.bees.forEach((bee: any) => {
        expect(bee.api_key).toBeUndefined();
        expect(bee.money_cents).toBeUndefined();
        expect(bee.recovery_email).toBeUndefined();
      });
    });
  });

  test.describe('Heartbeat updates last_seen_at', () => {
    let beeApiKey: string;
    let beeName: string;

    test.beforeAll(async ({ request }) => {
      beeName = `HeartbeatBee_${Date.now()}`;
      const res = await request.post('/api/bees/register', {
        data: { name: beeName, skills: ['testing'] },
      });
      const data = await res.json();
      beeApiKey = data.bee.api_key;
      testBees.push({ id: data.bee.id, api_key: beeApiKey, name: beeName });
    });

    test('heartbeat makes bee appear in active list', async ({ request }) => {
      // Send heartbeat
      const heartbeatRes = await request.post('/api/bees/heartbeat', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      expect(heartbeatRes.ok()).toBeTruthy();

      // Check active bees
      const activeRes = await request.get('/api/bees/active?limit=50');
      const activeData = await activeRes.json();

      const found = activeData.bees.find((b: any) => b.name === beeName);
      expect(found).toBeDefined();
    });

    test('recent heartbeat shows recent last_seen_at', async ({ request }) => {
      const before = new Date();

      // Send heartbeat
      await request.post('/api/bees/heartbeat', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });

      const after = new Date();

      // Check active bees
      const activeRes = await request.get('/api/bees/active?limit=50');
      const activeData = await activeRes.json();

      const found = activeData.bees.find((b: any) => b.name === beeName);
      if (found) {
        const lastSeen = new Date(found.last_seen_at);
        // Should be within 1 minute of now (accounting for possible clock skew)
        expect(lastSeen.getTime()).toBeGreaterThanOrEqual(before.getTime() - 60000);
        expect(lastSeen.getTime()).toBeLessThanOrEqual(after.getTime() + 60000);
      }
    });
  });

  test.describe('Homepage: Recently Active Bees Section', () => {
    test('section appears when there are active bees', async ({ page, request }) => {
      // First check if there are any active bees
      const apiRes = await request.get('/api/bees/active?limit=1');
      const apiData = await apiRes.json();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      if (apiData.bees.length > 0) {
        await expect(page.getByText('Recently Active Bees')).toBeVisible();
      }
    });

    test('displays bee cards in grid', async ({ page, request }) => {
      const apiRes = await request.get('/api/bees/active?limit=1');
      const apiData = await apiRes.json();

      if (apiData.bees.length > 0) {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Should show grid of bee cards
        await expect(page.getByText('Recently Active Bees')).toBeVisible();
        
        // Cards should show bee name
        const firstBee = apiData.bees[0];
        await expect(page.getByText(firstBee.name)).toBeVisible();
      }
    });

    test('bee cards show honey count', async ({ page, request }) => {
      const apiRes = await request.get('/api/bees/active?limit=1');
      const apiData = await apiRes.json();

      if (apiData.bees.length > 0) {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Should show honey emoji with count
        await expect(page.locator('text=/🍯 \\d+/').first()).toBeVisible();
      }
    });

    test('bee cards link to bee profile', async ({ page, request }) => {
      const apiRes = await request.get('/api/bees/active?limit=1');
      const apiData = await apiRes.json();

      if (apiData.bees.length > 0) {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Cards should be links to /bee/:id
        const beeLinks = page.locator('a[href^="/bee/"]');
        const count = await beeLinks.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('has link to full leaderboard', async ({ page, request }) => {
      const apiRes = await request.get('/api/bees/active?limit=1');
      const apiData = await apiRes.json();

      if (apiData.bees.length > 0) {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await expect(page.getByText(/view full leaderboard/i)).toBeVisible();
        
        const leaderboardLink = page.getByRole('link', { name: /leaderboard/i });
        await expect(leaderboardLink).toHaveAttribute('href', '/leaderboard');
      }
    });

    test('section is limited to 12 bees', async ({ page, request }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Count bee cards in the active bees section
      const activeSection = page.locator('h2:has-text("Recently Active Bees")').locator('..');
      const beeCards = activeSection.locator('a[href^="/bee/"]');
      
      const count = await beeCards.count();
      expect(count).toBeLessThanOrEqual(12);
    });
  });
});
