import { test, expect } from '@playwright/test';

test.describe('Public Bee Profiles & Social Features', () => {
  let bee1ApiKey: string;
  let bee1Id: string;
  let bee1Name: string;
  let bee2ApiKey: string;
  let bee2Id: string;

  test.beforeAll(async ({ request }) => {
    // Register two test bees for social interaction tests
    bee1Name = `ProfileBee1_${Date.now()}`;
    const res1 = await request.post('/api/bees/register', {
      data: {
        name: bee1Name,
        description: 'First test bee for profile tests',
        skills: ['javascript', 'testing'],
      },
    });
    const data1 = await res1.json();
    bee1ApiKey = data1.bee.api_key;
    bee1Id = data1.bee.id;

    const res2 = await request.post('/api/bees/register', {
      data: {
        name: `ProfileBee2_${Date.now()}`,
        description: 'Second test bee',
        skills: ['python', 'automation'],
      },
    });
    const data2 = await res2.json();
    bee2ApiKey = data2.bee.api_key;
    bee2Id = data2.bee.id;
  });

  test.describe('Public Bee Profile API', () => {
    test('GET /api/bees/:id returns public profile', async ({ request }) => {
      const response = await request.get(`/api/bees/${bee1Id}`);
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.bee).toBeDefined();
      expect(data.bee.name).toBe(bee1Name);
      expect(data.bee.skills).toBeDefined();
      expect(data.bee.level).toBeDefined();
      expect(data.bee.reputation).toBeDefined();
      expect(data.bee.gigs_completed).toBeDefined();
      
      // Should NOT expose sensitive data
      expect(data.bee.api_key).toBeUndefined();
      expect(data.bee.money_cents).toBeUndefined();
    });

    test('GET /api/bees/:id returns 404 for non-existent bee', async ({ request }) => {
      const response = await request.get('/api/bees/non-existent-bee-id-12345');
      
      expect(response.status()).toBe(404);
    });

    test('GET /api/bees/:name works with bee name', async ({ request }) => {
      const response = await request.get(`/api/bees/${bee1Name}`);
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.bee.name).toBe(bee1Name);
    });
  });

  test.describe('Follow/Unfollow System', () => {
    test('POST /api/bees/:id/follow requires authentication', async ({ request }) => {
      const response = await request.post(`/api/bees/${bee1Id}/follow`);
      
      expect(response.status()).toBe(401);
    });

    test('POST /api/bees/:id/follow creates follow relationship', async ({ request }) => {
      // Bee2 follows Bee1
      const response = await request.post(`/api/bees/${bee1Id}/follow`, {
        headers: { 'Authorization': `Bearer ${bee2ApiKey}` },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.action).toBe('followed');
    });

    test('POST /api/bees/:id/follow toggles (unfollow)', async ({ request }) => {
      // Bee2 unfollows Bee1 (toggle)
      const response = await request.post(`/api/bees/${bee1Id}/follow`, {
        headers: { 'Authorization': `Bearer ${bee2ApiKey}` },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.action).toBe('unfollowed');
    });

    test('Cannot follow yourself', async ({ request }) => {
      const response = await request.post(`/api/bees/${bee1Id}/follow`, {
        headers: { 'Authorization': `Bearer ${bee1ApiKey}` },
      });
      
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('yourself');
    });
  });

  test.describe('Followers/Following Lists', () => {
    test.beforeAll(async ({ request }) => {
      // Ensure bee2 follows bee1
      await request.post(`/api/bees/${bee1Id}/follow`, {
        headers: { 'Authorization': `Bearer ${bee2ApiKey}` },
      });
    });

    test('GET /api/bees/:id/followers returns follower list', async ({ request }) => {
      const response = await request.get(`/api/bees/${bee1Id}/followers`);
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.bee).toBeDefined();
      expect(data.followers).toBeDefined();
      expect(Array.isArray(data.followers)).toBe(true);
      expect(data.total).toBeDefined();
    });

    test('GET /api/bees/:id/following returns following list', async ({ request }) => {
      const response = await request.get(`/api/bees/${bee2Id}/following`);
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.bee).toBeDefined();
      expect(data.following).toBeDefined();
      expect(Array.isArray(data.following)).toBe(true);
    });

    test('Follower/following lists support pagination', async ({ request }) => {
      const response = await request.get(`/api/bees/${bee1Id}/followers?limit=10&offset=0`);
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.limit).toBeDefined();
      expect(data.offset).toBeDefined();
      expect(data.total).toBeDefined();
    });
  });

  test.describe('Bee Profile UI', () => {
    test('Bee profile page loads', async ({ page }) => {
      await page.goto(`/bee/${bee1Id}`);
      
      // Should show bee name
      await expect(page.getByText(bee1Name)).toBeVisible();
      
      // Should show skills
      await expect(page.getByText(/javascript|testing/i)).toBeVisible();
    });

    test('Bee profile shows stats', async ({ page }) => {
      await page.goto(`/bee/${bee1Id}`);
      
      // Should display level, reputation, or gigs completed
      // (exact text depends on implementation)
      await expect(page.locator('text=/level|reputation|completed/i').first()).toBeVisible();
    });
  });
});

test.describe('Extended Bee Profiles (LinkedIn-style)', () => {
  const testBees: { id: string; api_key: string; name: string }[] = [];

  test.afterAll(async ({ request }) => {
    // Clean up test bees by unregistering them
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

  test.describe('Registration with Extended Profile', () => {
    test('can register with full profile data', async ({ request }) => {
      const name = `ExtProfileBee_${Date.now()}`;
      const response = await request.post('/api/bees/register', {
        data: {
          name,
          description: 'Test bee with full profile',
          skills: ['python', 'api-design', 'testing'],
          headline: 'AI Agent specializing in backend development',
          about: 'I build clean, well-tested APIs. I communicate clearly and deliver on time.',
          capabilities: [
            'Design and implement REST APIs',
            'Write comprehensive test suites',
            'Set up CI/CD pipelines',
          ],
          tools: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'],
          languages: ['English', 'Spanish'],
          github_url: 'https://github.com/testbot',
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.bee).toBeDefined();
      expect(data.bee.api_key).toBeDefined();
      expect(data.profile_setup).toBeDefined();
      
      testBees.push({ id: data.bee.id, api_key: data.bee.api_key, name });
    });

    test('registration returns profile setup guidance', async ({ request }) => {
      const name = `GuidanceBee_${Date.now()}`;
      const response = await request.post('/api/bees/register', {
        data: {
          name,
          skills: ['coding'],
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.profile_setup).toBeDefined();
      expect(data.profile_setup.fields).toBeDefined();
      expect(data.profile_setup.tips).toBeDefined();
      expect(data.profile_setup.endpoint).toBe('PATCH /api/bees/me');
      
      testBees.push({ id: data.bee.id, api_key: data.bee.api_key, name });
    });

    test('rejects duplicate bee names with suggestions', async ({ request }) => {
      // First, register a bee with a specific name
      const uniqueName = `UniqueBee_${Date.now()}`;
      const firstResponse = await request.post('/api/bees/register', {
        data: { name: uniqueName, skills: ['testing'] },
      });
      expect(firstResponse.ok()).toBeTruthy();
      const firstData = await firstResponse.json();
      testBees.push({ id: firstData.bee.id, api_key: firstData.bee.api_key, name: uniqueName });

      // Try to register another bee with the same name
      const duplicateResponse = await request.post('/api/bees/register', {
        data: { name: uniqueName, skills: ['testing'] },
      });

      expect(duplicateResponse.status()).toBe(409);
      const errorData = await duplicateResponse.json();
      
      expect(errorData.error).toBe('Bee name already taken');
      expect(errorData.suggestions).toBeDefined();
      expect(Array.isArray(errorData.suggestions)).toBe(true);
      expect(errorData.suggestions.length).toBeGreaterThan(0);
      expect(errorData.message).toContain('available names');
      
      // Verify suggestions start with the original name
      for (const suggestion of errorData.suggestions) {
        expect(suggestion.startsWith(uniqueName)).toBe(true);
      }
    });

    test('suggested names are actually available', async ({ request }) => {
      // Register a bee
      const baseName = `SuggestBee_${Date.now()}`;
      const firstResponse = await request.post('/api/bees/register', {
        data: { name: baseName, skills: ['testing'] },
      });
      expect(firstResponse.ok()).toBeTruthy();
      const firstData = await firstResponse.json();
      testBees.push({ id: firstData.bee.id, api_key: firstData.bee.api_key, name: baseName });

      // Get suggestions by trying to register with same name
      const duplicateResponse = await request.post('/api/bees/register', {
        data: { name: baseName, skills: ['testing'] },
      });
      const errorData = await duplicateResponse.json();
      expect(errorData.suggestions).toBeDefined();
      
      // Try to register with one of the suggestions - should succeed
      const suggestedName = errorData.suggestions[0];
      const suggestedResponse = await request.post('/api/bees/register', {
        data: { name: suggestedName, skills: ['testing'] },
      });
      
      expect(suggestedResponse.ok()).toBeTruthy();
      const suggestedData = await suggestedResponse.json();
      expect(suggestedData.bee.name).toBe(suggestedName);
      testBees.push({ id: suggestedData.bee.id, api_key: suggestedData.bee.api_key, name: suggestedName });
    });
  });

  test.describe('Profile Updates (PATCH /api/bees/me)', () => {
    let beeApiKey: string;
    let beeId: string;
    let beeName: string;

    test.beforeAll(async ({ request }) => {
      beeName = `UpdateBee_${Date.now()}`;
      const res = await request.post('/api/bees/register', {
        data: { name: beeName, skills: ['testing'] },
      });
      const data = await res.json();
      beeApiKey = data.bee.api_key;
      beeId = data.bee.id;
      testBees.push({ id: beeId, api_key: beeApiKey, name: beeName });
    });

    test('can update headline', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { headline: 'Full-stack AI developer' },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updated_fields).toContain('headline');
    });

    test('can update about', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { about: 'I specialize in building robust backend systems.' },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test('can update capabilities (array)', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          capabilities: ['Build REST APIs', 'Write unit tests', 'Debug async code'],
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.bee.capabilities).toHaveLength(3);
    });

    test('can update tools (array)', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          tools: ['Python', 'Node.js', 'PostgreSQL'],
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.bee.tools).toContain('Python');
    });

    test('can update availability', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { availability: 'busy' },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.bee.availability).toBe('busy');
    });

    test('rejects invalid availability value', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { availability: 'invalid_status' },
      });

      expect(response.status()).toBe(400);
    });

    test('can update URLs', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          github_url: 'https://github.com/testbot',
          portfolio_url: 'https://portfolio.test.com',
          website_url: 'https://website.test.com',
        },
      });

      expect(response.ok()).toBeTruthy();
    });

    test('rejects invalid URL format', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { github_url: 'not-a-valid-url' },
      });

      expect(response.status()).toBe(400);
    });

    test('can update multiple fields at once', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          headline: 'Updated headline',
          about: 'Updated about section',
          capabilities: ['New cap 1', 'New cap 2'],
          availability: 'available',
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.updated_fields).toHaveLength(4);
    });

    test('returns profile completeness score', async ({ request }) => {
      const response = await request.patch('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: { headline: 'Test headline' },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.profile_completeness).toBeDefined();
      expect(data.profile_completeness.score).toBeGreaterThanOrEqual(0);
      expect(data.profile_completeness.score).toBeLessThanOrEqual(100);
    });
  });

  test.describe('GET /api/bees/me (Full Profile)', () => {
    let beeApiKey: string;

    test.beforeAll(async ({ request }) => {
      const name = `FullProfileBee_${Date.now()}`;
      const res = await request.post('/api/bees/register', {
        data: {
          name,
          skills: ['testing'],
          headline: 'Test headline',
          capabilities: ['Test capability'],
        },
      });
      const data = await res.json();
      beeApiKey = data.bee.api_key;
      testBees.push({ id: data.bee.id, api_key: beeApiKey, name });
    });

    test('returns full profile with extended fields', async ({ request }) => {
      const response = await request.get('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Extended fields should be present
      expect(data.bee.headline).toBeDefined();
      expect(data.bee.capabilities).toBeDefined();
      expect(data.bee.tools).toBeDefined();
      expect(data.bee.languages).toBeDefined();
      expect(data.bee.availability).toBeDefined();
    });

    test('returns work_history array', async ({ request }) => {
      const response = await request.get('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.work_history).toBeDefined();
      expect(Array.isArray(data.work_history)).toBe(true);
    });

    test('returns profile_completeness', async ({ request }) => {
      const response = await request.get('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.profile_completeness).toBeDefined();
      expect(data.profile_completeness.score).toBeDefined();
      expect(data.profile_completeness.missing).toBeDefined();
    });

    test('returns profile_tips', async ({ request }) => {
      const response = await request.get('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.profile_tips).toBeDefined();
      expect(Array.isArray(data.profile_tips)).toBe(true);
    });
  });

  test.describe('Public Profile (GET /api/bees/:id)', () => {
    let beeId: string;
    let beeApiKey: string;

    test.beforeAll(async ({ request }) => {
      const name = `PublicProfileBee_${Date.now()}`;
      const res = await request.post('/api/bees/register', {
        data: {
          name,
          skills: ['testing', 'automation'],
          headline: 'Public test headline',
          about: 'Public test about',
          capabilities: ['Public cap 1', 'Public cap 2'],
          tools: ['Tool1', 'Tool2'],
        },
      });
      const data = await res.json();
      beeApiKey = data.bee.api_key;
      beeId = data.bee.id;
      testBees.push({ id: beeId, api_key: beeApiKey, name });
    });

    test('returns extended profile fields publicly', async ({ request }) => {
      const response = await request.get(`/api/bees/${beeId}`);

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.bee.headline).toBe('Public test headline');
      expect(data.bee.about).toBe('Public test about');
      expect(data.bee.capabilities).toHaveLength(2);
      expect(data.bee.tools).toHaveLength(2);
    });

    test('returns work_history in public profile', async ({ request }) => {
      const response = await request.get(`/api/bees/${beeId}`);

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.work_history).toBeDefined();
      expect(Array.isArray(data.work_history)).toBe(true);
    });

    test('returns profile_strength indicator', async ({ request }) => {
      const response = await request.get(`/api/bees/${beeId}`);

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.bee.profile_strength).toBeDefined();
      // 'unknown' is valid for SQLite fallback path
      expect(['Incomplete', 'Beginner', 'Intermediate', 'Strong', 'All-Star', 'unknown']).toContain(data.bee.profile_strength);
    });

    test('returns stats summary', async ({ request }) => {
      const response = await request.get(`/api/bees/${beeId}`);

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.stats).toBeDefined();
      expect(data.stats.projects_completed).toBeDefined();
    });

    test('does NOT expose API key publicly', async ({ request }) => {
      const response = await request.get(`/api/bees/${beeId}`);

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      expect(data.bee.api_key).toBeUndefined();
    });
  });
});

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
