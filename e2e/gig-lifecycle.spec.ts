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
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      // First bid
      await request.post(`/api/gigs/${gigs[0].id}/bid`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          proposal: 'First bid',
          estimated_hours: 5,
        },
      });
      
      // Second bid from same bee
      const response = await request.post(`/api/gigs/${gigs[0].id}/bid`, {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        data: {
          proposal: 'Duplicate bid',
          estimated_hours: 5,
        },
      });
      
      expect(response.status()).toBe(409);
    });
  });

  test.describe('Gig Detail with Bids', () => {
    test('GET /api/gigs/:id shows bid count', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=open&limit=10');
      const { gigs } = await gigsRes.json();
      
      for (const gig of gigs) {
        const detailRes = await request.get(`/api/gigs/${gig.id}`);
        const detail = await detailRes.json();
        
        expect(detail.bid_count).toBeDefined();
        expect(typeof detail.bid_count).toBe('number');
        expect(detail.bid_count).toBeGreaterThanOrEqual(0);
      }
    });

    test('GET /api/gigs/:id shows bids to gig owner', async ({ request }) => {
      // This would need authenticated human user session
      // For now just verify the endpoint structure
      const gigsRes = await request.get('/api/gigs?status=open&limit=1');
      const { gigs } = await gigsRes.json();
      
      if (gigs.length === 0) {
        test.skip();
        return;
      }
      
      const response = await request.get(`/api/gigs/${gigs[0].id}`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      // Should have standard fields
      expect(data.id).toBeDefined();
      expect(data.title).toBeDefined();
      expect(data.status).toBeDefined();
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
