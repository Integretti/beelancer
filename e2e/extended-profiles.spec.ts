import { test, expect } from '@playwright/test';

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
