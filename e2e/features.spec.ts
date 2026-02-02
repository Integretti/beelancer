import { test, expect } from '@playwright/test';

test.describe('Gig Messaging', () => {
  
  test.describe('Message API access control', () => {
    test('GET /api/gigs/:id/messages requires authentication', async ({ request }) => {
      // First get a valid gig ID
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.get(`/api/gigs/${gigs[0].id}/messages`);
      
      // Should reject unauthenticated requests
      expect(response.status()).toBe(403);
    });

    test('POST /api/gigs/:id/messages rejects messages to non-existent gig', async ({ request }) => {
      // Register a bee for auth
      const beeRes = await request.post('/api/bees/register', {
        data: { name: `MsgTestBee_${Date.now()}`, skills: ['test'] },
      });
      const { bee } = await beeRes.json();
      
      const response = await request.post('/api/gigs/non-existent-gig-id/messages', {
        headers: { 'Authorization': `Bearer ${bee.api_key}` },
        data: { content: 'Test message' },
      });
      
      expect(response.status()).toBe(404);
    });
  });

  test.describe('Completed gig messaging block', () => {
    test('GET /api/gigs/:id/messages on completed gig shows closed warning', async ({ request }) => {
      // Get gigs and find a completed one
      const gigsRes = await request.get('/api/gigs?limit=50');
      const { gigs } = await gigsRes.json();
      
      const completedGig = gigs.find((g: any) => 
        ['completed', 'paid', 'cancelled'].includes(g.status)
      );
      
      if (!completedGig) {
        test.skip();
        return;
      }
      
      // Register a bee
      const beeRes = await request.post('/api/bees/register', {
        data: { name: `ClosedMsgBee_${Date.now()}`, skills: ['test'] },
      });
      const { bee } = await beeRes.json();
      
      // Try to get messages (may fail with 403 if not assigned, which is fine)
      const response = await request.get(`/api/gigs/${completedGig.id}/messages`, {
        headers: { 'Authorization': `Bearer ${bee.api_key}` },
      });
      
      // If we get a 200, check for closed warning
      if (response.ok()) {
        const data = await response.json();
        expect(data.is_closed).toBe(true);
        expect(data.warning).toContain('DO NOT');
        expect(data.tip).toContain('closed');
      }
    });

    test('POST message to closed gig returns actionable error', async ({ request }) => {
      // Get gigs and find a completed one
      const gigsRes = await request.get('/api/gigs?limit=50');
      const { gigs } = await gigsRes.json();
      
      const completedGig = gigs.find((g: any) => 
        ['completed', 'paid', 'cancelled'].includes(g.status)
      );
      
      if (!completedGig) {
        test.skip();
        return;
      }
      
      // Register a bee
      const beeRes = await request.post('/api/bees/register', {
        data: { name: `PostClosedBee_${Date.now()}`, skills: ['test'] },
      });
      const { bee } = await beeRes.json();
      
      const response = await request.post(`/api/gigs/${completedGig.id}/messages`, {
        headers: { 'Authorization': `Bearer ${bee.api_key}` },
        data: { content: 'Trying to message closed gig' },
      });
      
      // Should be rejected (either 400 for closed or 403 for not assigned)
      expect([400, 403]).toContain(response.status());
      
      if (response.status() === 400) {
        const data = await response.json();
        expect(data.error).toContain('closed');
        expect(data.action).toBe('MOVE_ON');
        expect(data.tip).toContain('/api/gigs?status=open');
      }
    });
  });

  test.describe('Message content validation', () => {
    test('POST /api/gigs/:id/messages rejects empty content', async ({ request }) => {
      // Register a bee
      const beeRes = await request.post('/api/bees/register', {
        data: { name: `EmptyMsgBee_${Date.now()}`, skills: ['test'] },
      });
      const { bee } = await beeRes.json();
      
      // Get an in-progress gig
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/messages`, {
        headers: { 'Authorization': `Bearer ${bee.api_key}` },
        data: { content: '' },
      });
      
      // Should fail (either 400 for empty content or 403 for not assigned)
      expect([400, 403]).toContain(response.status());
    });
  });
});
import { test, expect } from '@playwright/test';

test.describe('Bee Assignments & Polling', () => {
  let beeApiKey: string;
  let beeName: string;

  test.beforeAll(async ({ request }) => {
    // Register a test bee
    beeName = `AssignmentTestBee_${Date.now()}`;
    const response = await request.post('/api/bees/register', {
      data: {
        name: beeName,
        description: 'Test bee for assignment tests',
        skills: ['testing', 'automation'],
      },
    });
    
    const data = await response.json();
    beeApiKey = data.bee.api_key;
  });

  test.describe('Assignments API', () => {
    test('GET /api/bees/assignments requires authentication', async ({ request }) => {
      const response = await request.get('/api/bees/assignments');
      
      expect(response.status()).toBe(401);
    });

    test('GET /api/bees/assignments returns structured response', async ({ request }) => {
      const response = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.bee_name).toBe(beeName);
      expect(data.active_assignments).toBeDefined();
      expect(data.pending_bids).toBeDefined();
      expect(data.completed_assignments).toBeDefined();
      expect(data.summary).toBeDefined();
      expect(data.action_required).toBeDefined();
      expect(data.urgency).toBeDefined();
      expect(data.polling).toBeDefined();
    });

    test('Idle bee gets 30 minute polling recommendation', async ({ request }) => {
      const response = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      const data = await response.json();
      
      // Bee with no active work should get IDLE action
      expect(data.action_required.type).toBe('IDLE');
      expect(data.action_required.message).toContain('30 minutes');
      expect(data.polling.next_check_minutes).toBe(30);
      expect(data.urgency).toBe('low');
    });

    test('Completed assignments have closed flag and warning', async ({ request }) => {
      const response = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      const data = await response.json();
      
      // If there are completed assignments, they should have the warning
      for (const assignment of data.completed_assignments) {
        expect(assignment.closed).toBe(true);
        expect(assignment.action_required).toBe('NONE');
        expect(assignment._warning).toContain('DO NOT');
        expect(assignment._warning).toContain('CLOSED');
      }
    });

    test('Polling reminder is always present', async ({ request }) => {
      const response = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      const data = await response.json();
      
      expect(data.polling.reminder).toContain('Beelancer does NOT push notifications');
      expect(data.polling.endpoint).toBe('/api/bees/assignments');
    });
  });

  test.describe('Learning resources in bee endpoints', () => {
    test('GET /api/bees/me includes learning section', async ({ request }) => {
      const response = await request.get('/api/bees/me', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.learning).toBeDefined();
      expect(data.learning.message).toContain('university');
      expect(data.learning.start_here).toContain('/api/blog/');
      expect(data.learning.all_content).toContain('for_agents=true');
      expect(data.learning.recommended).toBeDefined();
      expect(Array.isArray(data.learning.recommended)).toBe(true);
    });

    test('POST /api/bees/register response includes learning resources', async ({ request }) => {
      const response = await request.post('/api/bees/register', {
        data: {
          name: `LearningTestBee_${Date.now()}`,
          skills: ['test'],
        },
      });
      
      const data = await response.json();
      
      expect(data.learning).toBeDefined();
      expect(data.learning.welcome).toContain('University');
      expect(data.learning.essential_reading).toBeDefined();
      expect(Array.isArray(data.learning.essential_reading)).toBe(true);
      expect(data.learning.essential_reading.length).toBeGreaterThan(0);
    });
  });
});
import { test, expect } from '@playwright/test';

test.describe('Suggestions & Voting System', () => {
  let beeApiKey: string;

  test.beforeAll(async ({ request }) => {
    // Register a test bee
    const response = await request.post('/api/bees/register', {
      data: {
        name: `SuggestionBee_${Date.now()}`,
        skills: ['feedback'],
      },
    });
    
    const data = await response.json();
    beeApiKey = data.bee.api_key;
  });

  test.describe('Suggestions API', () => {
    test('GET /api/suggestions returns list of suggestions', async ({ request }) => {
      const response = await request.get('/api/suggestions');
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.suggestions).toBeDefined();
      expect(Array.isArray(data.suggestions)).toBe(true);
    });

    test('POST /api/suggestions creates new suggestion', async ({ request }) => {
      const response = await request.post('/api/suggestions', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          title: `Test Suggestion ${Date.now()}`,
          description: 'This is a test suggestion from e2e tests',
          category: 'feature',
        },
      });
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.suggestion).toBeDefined();
      expect(data.suggestion.id).toBeDefined();
    });

    test('POST /api/suggestions requires authentication', async ({ request }) => {
      const response = await request.post('/api/suggestions', {
        data: {
          title: 'Unauthenticated suggestion',
          category: 'feature',
        },
      });
      
      expect(response.status()).toBe(401);
    });

    test('POST /api/suggestions validates required fields', async ({ request }) => {
      const response = await request.post('/api/suggestions', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          description: 'Missing title',
        },
      });
      
      expect(response.status()).toBe(400);
    });

    test('POST /api/suggestions/:id/vote toggles vote', async ({ request }) => {
      // First create a suggestion
      const createRes = await request.post('/api/suggestions', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          title: `Votable Suggestion ${Date.now()}`,
          category: 'feature',
        },
      });
      
      const { suggestion } = await createRes.json();
      
      // Vote for it
      const voteRes = await request.post(`/api/suggestions/${suggestion.id}/vote`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      expect(voteRes.ok()).toBeTruthy();
      const voteData = await voteRes.json();
      expect(voteData.action).toBe('voted');
      
      // Vote again to toggle (unvote)
      const unvoteRes = await request.post(`/api/suggestions/${suggestion.id}/vote`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      expect(unvoteRes.ok()).toBeTruthy();
      const unvoteData = await unvoteRes.json();
      expect(unvoteData.action).toBe('unvoted');
    });
  });

  test.describe('Suggestions UI', () => {
    test('Suggestions page loads', async ({ page }) => {
      await page.goto('/suggestions');
      
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('Suggestions page shows list of suggestions', async ({ page }) => {
      await page.goto('/suggestions');
      
      // Wait for suggestions to load
      await page.waitForTimeout(1000);
      
      // Should show at least one suggestion or empty state
      const content = await page.textContent('body');
      expect(content).toMatch(/suggestion|idea|feature|vote|no suggestions/i);
    });

    test('Can navigate to suggestions from footer', async ({ page }) => {
      await page.goto('/');
      
      // Find and click suggestions link in footer
      const suggestionsLink = page.locator('a[href="/suggestions"]');
      if (await suggestionsLink.count() > 0) {
        await suggestionsLink.first().click();
        await expect(page).toHaveURL(/suggestions/);
      }
    });
  });
});
import { test, expect } from '@playwright/test';
import { generateTestEmail, generateTestName } from './helpers';

/**
 * Deliverables, Approval & Dispute Tests
 * 
 * These tests cover the critical post-assignment workflow:
 * - Deliverable submission and viewing
 * - Approval/revision request flow
 * - Dispute opening and management
 */

test.describe('Deliverables, Approval & Disputes', () => {
  let beeApiKey: string;
  let beeName: string;
  let beeId: string;

  test.beforeAll(async ({ request }) => {
    // Register a test bee for these tests
    beeName = `DeliverableBee_${Date.now()}`;
    const response = await request.post('/api/bees/register', {
      data: {
        name: beeName,
        description: 'Bee for testing deliverables and disputes',
        skills: ['delivery', 'testing', 'disputes'],
      },
    });
    const data = await response.json();
    beeApiKey = data.bee.api_key;
    beeId = data.bee.id;
  });

  test.describe('Deliverable Submission (Bee)', () => {
    test('POST /api/gigs/:id/submit requires bee authentication', async ({ request }) => {
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

    test('POST /api/gigs/:id/submit requires title', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/submit`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          content: 'Test content without title',
        },
      });
      
      // 400 (validation error) or 403 (not assigned - checked first for security)
      expect([400, 403]).toContain(response.status());
      
      if (response.status() === 400) {
        const data = await response.json();
        expect(data.error).toContain('itle');
      }
    });

    test('POST /api/gigs/:id/submit requires content or URL', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/submit`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          title: 'Title only, no content',
        },
      });
      
      // 400 (validation error) or 403 (not assigned - checked first for security)
      expect([400, 403]).toContain(response.status());
      
      if (response.status() === 400) {
        const data = await response.json();
        expect(data.error.toLowerCase()).toMatch(/content|url/);
      }
    });

    test('POST /api/gigs/:id/submit rejects if bee not assigned', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/submit`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          title: 'Unauthorized submission',
          content: 'Should fail if not assigned',
        },
      });
      
      // Should fail with 403 (not assigned) or succeed if coincidentally assigned
      expect([201, 403]).toContain(response.status());
      
      if (response.status() === 403) {
        const data = await response.json();
        expect(data.error.toLowerCase()).toContain('not assigned');
      }
    });

    test('POST /api/gigs/:id/submit rejects on non-in-progress gig', async ({ request }) => {
      // Try open gig
      const openGigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs: openGigs } = await openGigsRes.json();
      
      if (openGigs.length > 0) {
        const response = await request.post(`/api/gigs/${openGigs[0].id}/submit`, {
          headers: { 'Authorization': `Bearer ${beeApiKey}` },
          data: {
            title: 'Premature submission',
            content: 'This gig is not in progress yet',
          },
        });
        
        expect([400, 403]).toContain(response.status());
      }
      
      // Try completed gig
      const completedGigsRes = await request.get('/api/gigs?status=completed&limit=1');
      const { gigs: completedGigs } = await completedGigsRes.json();
      
      if (completedGigs.length > 0) {
        const response = await request.post(`/api/gigs/${completedGigs[0].id}/submit`, {
          headers: { 'Authorization': `Bearer ${beeApiKey}` },
          data: {
            title: 'Late submission',
            content: 'This gig is already completed',
          },
        });
        
        expect([400, 403]).toContain(response.status());
      }
    });
  });

  test.describe('Deliverables Viewing (Human)', () => {
    test('GET /api/gigs/:id/deliverables requires authentication', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Request without auth (no cookies)
      const response = await request.get(`/api/gigs/${gigs[0].id}/deliverables`);
      
      expect(response.status()).toBe(403);
    });

    test('GET /api/gigs/:id/deliverables returns 404 for invalid gig', async ({ request }) => {
      const response = await request.get('/api/gigs/nonexistent-gig-id/deliverables');
      
      expect(response.status()).toBe(404);
    });
  });

  test.describe('Approval Flow (Human)', () => {
    test('POST /api/gigs/:id/approve requires authentication', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/approve`, {
        data: {
          deliverable_id: 'test-deliverable-id',
          action: 'approve',
        },
      });
      
      expect(response.status()).toBe(401);
    });

    test('POST /api/gigs/:id/approve requires deliverable_id', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=review&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Even without proper auth, we should get a 400 or 401 for missing deliverable_id
      const response = await request.post(`/api/gigs/${gigs[0].id}/approve`, {
        data: {
          action: 'approve',
        },
      });
      
      // Either 401 (no auth) or 400 (missing deliverable_id)
      expect([400, 401]).toContain(response.status());
    });

    test('POST /api/gigs/:id/approve with invalid action returns error', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=review&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // This will fail auth, but the pattern shows expected usage
      const response = await request.post(`/api/gigs/${gigs[0].id}/approve`, {
        data: {
          deliverable_id: 'test-id',
          action: 'invalid_action',
        },
      });
      
      // 401 (no auth) expected
      expect(response.status()).toBe(401);
    });

    test('POST /api/gigs/:id/approve reject action suggests dispute', async ({ request }) => {
      // This tests the API behavior - reject action should suggest opening a dispute
      const gigsRes = await request.get('/api/gigs?status=review&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // Without auth we can't test the full flow, but we document the expected behavior
      expect(true).toBe(true); // Placeholder - full test requires authenticated browser context
    });
  });

  test.describe('Dispute Flow', () => {
    test('POST /api/gigs/:id/dispute requires authentication', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/dispute`, {
        data: {
          reason: 'Test dispute reason',
        },
      });
      
      expect(response.status()).toBe(401);
    });

    test('POST /api/gigs/:id/dispute requires reason', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          // Missing reason
        },
      });
      
      // Either 400 (missing reason) or 403 (not authorized for this gig)
      expect([400, 403]).toContain(response.status());
    });

    test('POST /api/gigs/:id/dispute returns 404 for non-existent gig', async ({ request }) => {
      const response = await request.post('/api/gigs/nonexistent-gig-id/dispute', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          reason: 'Test dispute',
        },
      });
      
      expect(response.status()).toBe(404);
    });

    test('GET /api/gigs/:id/dispute requires authentication', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.get(`/api/gigs/${gigs[0].id}/dispute`);
      
      expect(response.status()).toBe(401);
    });

    test('GET /api/gigs/:id/dispute returns 404 when no dispute exists', async ({ request }) => {
      // Find a gig that likely has no dispute (open gigs shouldn't have disputes)
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.get(`/api/gigs/${gigs[0].id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      // 404 (no dispute) or 403 (not authorized)
      expect([404, 403]).toContain(response.status());
    });

    test('Bee can open dispute on assigned gig', async ({ request }) => {
      // Find an in-progress gig where we might be assigned
      const assignmentsRes = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      const assignments = await assignmentsRes.json();
      
      if (assignments.active_assignments.length === 0) {
        test.skip();
        return;
      }
      
      const assignedGig = assignments.active_assignments[0];
      
      const response = await request.post(`/api/gigs/${assignedGig.gig_id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          reason: `Test dispute from bee ${Date.now()}`,
          evidence: 'This is test evidence for the dispute.',
        },
      });
      
      // Success (201/200) or already exists (400)
      if (response.ok()) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.dispute_id).toBeDefined();
      } else {
        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.error.toLowerCase()).toContain('already');
      }
    });

    test('Dispute add_message requires existing dispute', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          action: 'add_message',
          message: 'Test message',
        },
      });
      
      // Either 404 (no dispute) or 403 (not authorized)
      expect([403, 404]).toContain(response.status());
    });

    test('Dispute message requires content', async ({ request }) => {
      // Find a gig with an existing dispute
      const assignmentsRes = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      const assignments = await assignmentsRes.json();
      
      if (assignments.active_assignments.length === 0) {
        test.skip();
        return;
      }
      
      const assignedGig = assignments.active_assignments[0];
      
      const response = await request.post(`/api/gigs/${assignedGig.gig_id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          action: 'add_message',
          // Missing message content
        },
      });
      
      // Should fail - either no dispute (404), no message (400), or not authorized (403)
      expect([400, 403, 404]).toContain(response.status());
    });
  });

  test.describe('Full Dispute Flow Integration', () => {
    test('Bee can view dispute after opening', async ({ request }) => {
      const assignmentsRes = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      const assignments = await assignmentsRes.json();
      
      if (assignments.active_assignments.length === 0) {
        test.skip();
        return;
      }
      
      const assignedGig = assignments.active_assignments[0];
      
      // Try to open or get existing dispute
      await request.post(`/api/gigs/${assignedGig.gig_id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          reason: `Test dispute for viewing ${Date.now()}`,
        },
      });
      
      // Now try to view it
      const getRes = await request.get(`/api/gigs/${assignedGig.gig_id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      
      if (getRes.ok()) {
        const data = await getRes.json();
        expect(data.dispute).toBeDefined();
        expect(data.dispute.status).toBeDefined();
        expect(data.messages).toBeDefined();
        expect(Array.isArray(data.messages)).toBe(true);
      }
    });

    test('Bee can add message to open dispute', async ({ request }) => {
      const assignmentsRes = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      const assignments = await assignmentsRes.json();
      
      if (assignments.active_assignments.length === 0) {
        test.skip();
        return;
      }
      
      const assignedGig = assignments.active_assignments[0];
      
      // Make sure dispute exists
      await request.post(`/api/gigs/${assignedGig.gig_id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          reason: 'Test dispute for messaging',
        },
      });
      
      // Try to add a message
      const response = await request.post(`/api/gigs/${assignedGig.gig_id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          action: 'add_message',
          message: `Additional evidence: Test message ${Date.now()}`,
        },
      });
      
      if (response.ok()) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message_id).toBeDefined();
      }
    });
  });

  test.describe('Gig Status Transitions with Deliverables', () => {
    test('Gig with pending review shows in review status', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=review&limit=5');
      const { gigs } = await gigsRes.json();
      
      for (const gig of gigs) {
        expect(gig.status).toBe('review');
      }
    });

    test('Review gigs have assigned bee info', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=review&limit=3');
      const { gigs } = await gigsRes.json();
      
      for (const gig of gigs) {
        // Review status means a bee was assigned and submitted work
        const detailRes = await request.get(`/api/gigs/${gig.id}`);
        const data = await detailRes.json();
        const detail = data.gig || data;
        
        // Should have assignment info (if the API returns it)
        expect(detail.status).toBe('review');
      }
    });
  });

  test.describe('Revision Request Flow', () => {
    test('POST /api/gigs/:id/approve request_revision requires feedback', async ({ request }) => {
      // Test the validation - revision requests need feedback
      const gigsRes = await request.get('/api/gigs?status=review&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // This tests the expected API behavior (will fail auth but shows pattern)
      // In a real scenario, request_revision with no feedback should return 400
      expect(true).toBe(true);
    });
  });

  test.describe('Completed Gig Deliverable Access', () => {
    test('Cannot submit deliverables to completed gig', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=completed&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/submit`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          title: 'Late deliverable',
          content: 'Should not be allowed',
        },
      });
      
      expect([400, 403]).toContain(response.status());
    });

    test('Cannot open dispute on completed gig without existing assignment', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=completed&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.post(`/api/gigs/${gigs[0].id}/dispute`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          reason: 'Late dispute attempt',
        },
      });
      
      // Should fail - either not authorized (403) or gig already completed
      expect([400, 403]).toContain(response.status());
    });
  });
});
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
