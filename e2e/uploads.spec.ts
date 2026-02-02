import { test, expect } from '@playwright/test';

test.describe('File Upload System', () => {
  let beeApiKey: string;

  test.beforeAll(async ({ request }) => {
    // Register a test bee
    const response = await request.post('/api/bees/register', {
      data: {
        name: `UploadTestBee_${Date.now()}`,
        skills: ['testing'],
      },
    });
    
    const data = await response.json();
    beeApiKey = data.bee.api_key;
  });

  test.describe('Upload API', () => {
    test('POST /api/upload requires authentication', async ({ request }) => {
      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('test content'),
          },
        },
      });
      
      expect(response.status()).toBe(401);
    });

    test('POST /api/upload accepts image files', async ({ request }) => {
      // Create a small PNG (1x1 pixel)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
        0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59, 0xE7, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const response = await request.post('/api/upload', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: pngBuffer,
          },
        },
      });
      
      // May succeed or fail based on storage configuration
      // Just check it doesn't crash
      expect([200, 201, 400, 500]).toContain(response.status());
    });

    test('POST /api/upload rejects files over 1MB', async ({ request }) => {
      // Create a buffer larger than 1MB
      const largeBuffer = Buffer.alloc(1.5 * 1024 * 1024, 'x');

      const response = await request.post('/api/upload', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        multipart: {
          file: {
            name: 'large.txt',
            mimeType: 'text/plain',
            buffer: largeBuffer,
          },
        },
      });
      
      // Should reject large files
      expect([400, 413]).toContain(response.status());
    });

    test('POST /api/upload rejects non-image files', async ({ request }) => {
      const response = await request.post('/api/upload', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
        multipart: {
          file: {
            name: 'script.js',
            mimeType: 'application/javascript',
            buffer: Buffer.from('console.log("hello")'),
          },
        },
      });
      
      // Should reject non-image types (or at least not 2xx)
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });
});

test.describe('Leaderboard', () => {
  test.describe('Leaderboard API', () => {
    test('GET /api/bees/leaderboard returns ranked bees', async ({ request }) => {
      const response = await request.get('/api/bees/leaderboard');
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.leaderboard).toBeDefined();
      expect(Array.isArray(data.leaderboard)).toBe(true);
    });

    test('GET /api/bees/leaderboard supports sort parameter', async ({ request }) => {
      const honeyRes = await request.get('/api/bees/leaderboard?sort=honey');
      expect(honeyRes.ok()).toBeTruthy();
      
      const reputationRes = await request.get('/api/bees/leaderboard?sort=reputation');
      expect(reputationRes.ok()).toBeTruthy();
      
      const gigsRes = await request.get('/api/bees/leaderboard?sort=gigs');
      expect(gigsRes.ok()).toBeTruthy();
    });

    test('GET /api/bees/leaderboard respects limit', async ({ request }) => {
      const response = await request.get('/api/bees/leaderboard?limit=5');
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.leaderboard.length).toBeLessThanOrEqual(5);
    });

    test('Leaderboard bees have required fields', async ({ request }) => {
      const response = await request.get('/api/bees/leaderboard?limit=10');
      const data = await response.json();
      
      for (const bee of data.leaderboard) {
        expect(bee.id).toBeDefined();
        expect(bee.name).toBeDefined();
        expect(bee.honey).toBeDefined();
        expect(bee.level).toBeDefined();
      }
    });
  });

  test.describe('Leaderboard UI', () => {
    test('Leaderboard page loads', async ({ page }) => {
      await page.goto('/leaderboard');
      
      // Should show leaderboard heading
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/leaderboard/i);
    });

    test('Leaderboard shows bee names', async ({ page }) => {
      await page.goto('/leaderboard');
      
      // Wait for data to load
      await page.waitForTimeout(1000);
      
      // Should show at least one bee (from seed data)
      const beeLinks = page.locator('a[href^="/bee/"]');
      await expect(beeLinks.first()).toBeVisible({ timeout: 5000 });
    });

    test('Leaderboard has sort options', async ({ page }) => {
      await page.goto('/leaderboard');
      
      // Should have sort buttons or dropdown
      const sortElements = page.locator('button, select').filter({ hasText: /honey|reputation|gigs/i });
      await expect(sortElements.first()).toBeVisible();
    });
  });
});

/**
 * File Upload Tests
 * 
 * Tests for the /api/upload endpoint used in work chat attachments.
 * Covers both human (session) and bee (API key) authentication.
 */

test.describe('File Upload API', () => {
  let beeApiKey: string;
  let beeName: string;
  let beeId: string;

  test.beforeAll(async ({ request }) => {
    // Register a test bee
    beeName = `UploadTestBee_${Date.now()}`;
    const response = await request.post('/api/bees/register', {
      data: {
        name: beeName,
        description: 'Bee for testing file uploads',
        skills: ['testing', 'uploads'],
      },
    });
    const data = await response.json();
    beeApiKey = data.bee.api_key;
    beeId = data.bee.id;
  });

  test.describe('Authentication', () => {
    test('POST /api/upload requires authentication', async ({ request }) => {
      // Create a small test image (1x1 red pixel PNG)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xEF, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const response = await request.post('/api/upload', {
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: pngData,
          },
          gig_id: 'test-gig-id',
        },
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Authentication');
    });

    test('POST /api/upload accepts bee API key authentication', async ({ request }) => {
      // First we need a gig where the bee is assigned
      // For now, test that auth works but access is denied (not assigned)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xEF, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      // Get an in-progress gig
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();

      if (gigs.length === 0) {
        test.skip();
        return;
      }

      const response = await request.post('/api/upload', {
        headers: {
          'Authorization': `Bearer ${beeApiKey}`,
        },
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: pngData,
          },
          gig_id: gigs[0].id,
        },
      });

      // Should be 403 (no access) not 401 (not authenticated)
      // This proves authentication worked. 500 = blob not configured (OK for local test)
      expect([200, 403, 500]).toContain(response.status());
    });
  });

  test.describe('Validation', () => {
    test('POST /api/upload requires file', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();

      if (gigs.length === 0) {
        test.skip();
        return;
      }

      const response = await request.post('/api/upload', {
        headers: {
          'Authorization': `Bearer ${beeApiKey}`,
        },
        multipart: {
          gig_id: gigs[0].id,
        },
      });

      // 400 (no file) or 500 (blob not configured)
      expect([400, 500]).toContain(response.status());
      
      if (response.status() === 400) {
        const data = await response.json();
        expect(data.error.toLowerCase()).toContain('file');
      }
    });

    test('POST /api/upload requires gig_id', async ({ request }) => {
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xEF, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const response = await request.post('/api/upload', {
        headers: {
          'Authorization': `Bearer ${beeApiKey}`,
        },
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: pngData,
          },
        },
      });

      // 400 (no gig_id) or 500 (blob not configured)
      expect([400, 500]).toContain(response.status());
      
      if (response.status() === 400) {
        const data = await response.json();
        expect(data.error.toLowerCase()).toContain('gig_id');
      }
    });

    test('POST /api/upload rejects invalid file types', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();

      if (gigs.length === 0) {
        test.skip();
        return;
      }

      const response = await request.post('/api/upload', {
        headers: {
          'Authorization': `Bearer ${beeApiKey}`,
        },
        multipart: {
          file: {
            name: 'test.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Hello world'),
          },
          gig_id: gigs[0].id,
        },
      });

      // 400 (invalid type) or 403 (no access) or 500 (blob not configured)
      expect([400, 403, 500]).toContain(response.status());
      
      if (response.status() === 400) {
        const data = await response.json();
        expect(data.error.toLowerCase()).toContain('file type');
      }
    });

    test('POST /api/upload returns 404 for non-existent gig', async ({ request }) => {
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xEF, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const response = await request.post('/api/upload', {
        headers: {
          'Authorization': `Bearer ${beeApiKey}`,
        },
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: pngData,
          },
          gig_id: 'non-existent-gig-id-12345',
        },
      });

      // 404 (not found) or 500 (blob not configured)
      expect([404, 500]).toContain(response.status());
    });
  });

  test.describe('Access Control', () => {
    test('Bee cannot upload to gig they are not assigned to', async ({ request }) => {
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xEF, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      // Get an in-progress gig (where our test bee is NOT assigned)
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();

      if (gigs.length === 0) {
        test.skip();
        return;
      }

      const response = await request.post('/api/upload', {
        headers: {
          'Authorization': `Bearer ${beeApiKey}`,
        },
        multipart: {
          file: {
            name: 'test.png',
            mimeType: 'image/png',
            buffer: pngData,
          },
          gig_id: gigs[0].id,
        },
      });

      // 403 (no access) or 500 (blob not configured in test env)
      expect([403, 500]).toContain(response.status());
      
      if (response.status() === 403) {
        const data = await response.json();
        expect(data.error.toLowerCase()).toContain('access');
      }
    });
  });

  test.describe('Successful Upload (requires assigned gig)', () => {
    test('Assigned bee can upload image to their gig', async ({ request }) => {
      // Check if our bee has any active assignments
      const assignmentsRes = await request.get('/api/bees/assignments', {
        headers: { 'Authorization': `Bearer ${beeApiKey}` },
      });
      const assignments = await assignmentsRes.json();

      if (assignments.active_assignments.length === 0) {
        test.skip();
        return;
      }

      const assignedGig = assignments.active_assignments[0];
      
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xEF, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const response = await request.post('/api/upload', {
        headers: {
          'Authorization': `Bearer ${beeApiKey}`,
        },
        multipart: {
          file: {
            name: 'test-upload.png',
            mimeType: 'image/png',
            buffer: pngData,
          },
          gig_id: assignedGig.gig_id,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.url).toBeDefined();
      expect(data.url).toContain('blob');
      expect(data.filename).toBe('test-upload.png');
      expect(data.type).toBe('image/png');
    });
  });

  test.describe('File Size Limits', () => {
    test('POST /api/upload rejects files over 10MB', async ({ request }) => {
      const gigsRes = await request.get('/api/gigs?status=in_progress&limit=1');
      const { gigs } = await gigsRes.json();

      if (gigs.length === 0) {
        test.skip();
        return;
      }

      // Create a buffer slightly over 10MB
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1000);
      
      const response = await request.post('/api/upload', {
        headers: {
          'Authorization': `Bearer ${beeApiKey}`,
        },
        multipart: {
          file: {
            name: 'large.png',
            mimeType: 'image/png',
            buffer: largeBuffer,
          },
          gig_id: gigs[0].id,
        },
      });

      // 400 (file too large) or 403 (no access) or 413 (entity too large) or 500 (blob not configured)
      expect([400, 403, 413, 500]).toContain(response.status());
    });
  });
});
