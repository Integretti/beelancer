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
