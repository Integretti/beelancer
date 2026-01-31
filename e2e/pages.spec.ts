import { test, expect } from '@playwright/test';

test.describe('Public Pages', () => {
  
  test.describe('Homepage', () => {
    test('should load without errors', async ({ page }) => {
      // Listen for console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Listen for page errors (uncaught exceptions)
      const pageErrors: string[] = [];
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const response = await page.goto('/');
      
      // Should return 200
      expect(response?.status()).toBe(200);
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');
      
      // Should not have "Application error" message
      const appError = await page.locator('text=Application error').count();
      expect(appError).toBe(0);
      
      // Should not have critical page errors
      expect(pageErrors.filter(e => e.includes('TypeError'))).toHaveLength(0);
    });

    test('should display key elements', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Header
      await expect(page.getByText('Beelancer')).toBeVisible();
      
      // Hero section - updated copy
      await expect(page.getByRole('heading', { name: /gig marketplace.*ai agents/i })).toBeVisible();
      await expect(page.getByText(/ai agents browse gigs/i)).toBeVisible();
      
      // Bot registration section
      await expect(page.getByText(/send your ai agent/i)).toBeVisible();
      await expect(page.getByText(/skill\.md/i)).toBeVisible();
      
      // API docs link
      await expect(page.getByRole('link', { name: /api docs/i })).toBeVisible();
    });

    test('should display stats section with valid numbers', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Stats should be visible
      await expect(page.getByText(/bees buzzing/i)).toBeVisible();
      await expect(page.getByText(/open gigs/i)).toBeVisible();
      await expect(page.getByText(/delivered/i)).toBeVisible();
      await expect(page.getByText(/🍯 earned/i)).toBeVisible();
      
      // Stats numbers should be valid (not NaN or undefined)
      const honeyText = await page.locator('text=🍯 earned').locator('..').locator('div').first().textContent();
      expect(honeyText).not.toContain('NaN');
      expect(honeyText).not.toContain('undefined');
    });

    test('should display gigs section', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await expect(page.getByRole('heading', { name: /fresh gigs/i })).toBeVisible();
      
      // Category dropdown
      await expect(page.getByRole('combobox')).toBeVisible();
    });

    test('should have working navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Click API docs link
      await page.click('a:has-text("API Docs")');
      await expect(page).toHaveURL(/\/docs/);
      
      // Go back and click Start posting gigs (should go to dashboard)
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.click('a:has-text("Start posting gigs")');
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle API failures gracefully', async ({ page }) => {
      // Intercept stats API to simulate failure
      await page.route('**/api/stats', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' })
        });
      });

      await page.goto('/');
      
      // Page should still load without crashing
      const response = await page.waitForLoadState('networkidle');
      
      // Should not show application error
      const appError = await page.locator('text=Application error').count();
      expect(appError).toBe(0);
    });
  });

  test.describe('API Docs Page', () => {
    test('should load and display documentation', async ({ page }) => {
      await page.goto('/docs');
      
      await expect(page.getByRole('heading', { name: /api reference/i })).toBeVisible();
      
      // Base URL section
      await expect(page.getByText(/beelancer\.ai\/api/)).toBeVisible();
      
      // Authentication section
      await expect(page.getByText(/authorization/i)).toBeVisible();
      
      // Quick start section
      await expect(page.getByRole('heading', { name: /quick start/i })).toBeVisible();
    });

    test('should have expandable endpoint cards', async ({ page }) => {
      await page.goto('/docs');
      
      // Find a POST endpoint card
      const registerEndpoint = page.getByText('/api/bees/register').first();
      await expect(registerEndpoint).toBeVisible();
      
      // Click to expand
      await registerEndpoint.click();
      
      // Should show details
      await expect(page.getByText(/unique name for your bee/i).first()).toBeVisible();
    });

    test('should display response codes table', async ({ page }) => {
      await page.goto('/docs');
      
      await expect(page.getByRole('heading', { name: /response codes/i })).toBeVisible();
      await expect(page.getByText('200')).toBeVisible();
      await expect(page.getByText('401')).toBeVisible();
      await expect(page.getByText('404')).toBeVisible();
    });
  });

  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');
      
      await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
      await expect(page.getByPlaceholder(/you@example.com/i)).toBeVisible();
      await expect(page.getByPlaceholder(/your password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
    });

    test('should have link to signup', async ({ page }) => {
      await page.goto('/login');
      
      await page.click('a:has-text("Create an account")');
      await expect(page).toHaveURL(/\/signup/);
    });
  });

  test.describe('Signup Page', () => {
    test('should display signup form', async ({ page }) => {
      await page.goto('/signup');
      
      await expect(page.getByRole('heading', { name: /join the hive/i })).toBeVisible();
      await expect(page.getByPlaceholder(/what should we call you/i)).toBeVisible();
      await expect(page.getByPlaceholder(/you@example.com/i)).toBeVisible();
      await expect(page.getByPlaceholder(/min 8 characters/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    });

    test('should have link to login', async ({ page }) => {
      await page.goto('/signup');
      
      await page.click('a:has-text("Log in")');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Verify Page', () => {
    test('should display verification form', async ({ page }) => {
      await page.goto('/verify');
      
      await expect(page.getByRole('heading', { name: /enter your code/i })).toBeVisible();
      await expect(page.getByPlaceholder(/enter code/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /verify/i })).toBeVisible();
    });
  });

  test.describe('Skill.md Route', () => {
    test('should return markdown content', async ({ request }) => {
      const response = await request.get('/skill.md');
      
      expect(response.ok()).toBeTruthy();
      expect(response.headers()['content-type']).toContain('text/markdown');
      
      const content = await response.text();
      expect(content).toContain('Beelancer');
      expect(content).toContain('API');
    });
  });
});

test.describe('API Endpoints Health', () => {
  test('stats API should return valid JSON', async ({ request }) => {
    const response = await request.get('/api/stats');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(typeof data.open_gigs).toBe('number');
    expect(typeof data.total_bees).toBe('number');
    expect(typeof data.total_honey).toBe('number');
    expect(data.total_honey).not.toBeNaN();
  });

  test('gigs API should return valid JSON', async ({ request }) => {
    const response = await request.get('/api/gigs?status=open');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(Array.isArray(data.gigs)).toBe(true);
  });

  test('gig detail API should work for all gigs (human and bee created)', async ({ request }) => {
    // Get list of gigs
    const listResponse = await request.get('/api/gigs?status=open');
    expect(listResponse.ok()).toBeTruthy();
    
    const listData = await listResponse.json();
    const gigs = listData.gigs;
    
    // Test each gig's detail endpoint
    for (const gig of gigs.slice(0, 5)) { // Test first 5 gigs
      const detailResponse = await request.get(`/api/gigs/${gig.id}`);
      
      expect(detailResponse.ok(), `Gig ${gig.id} (${gig.title}) should be accessible`).toBeTruthy();
      
      const detailData = await detailResponse.json();
      expect(detailData.gig).toBeDefined();
      expect(detailData.gig.id).toBe(gig.id);
      expect(detailData.gig.title).toBe(gig.title);
      
      // Should have creator info regardless of type
      if (detailData.gig.creator_type === 'bee') {
        expect(detailData.gig.creator_bee_name, `Bee-created gig ${gig.id} should have creator_bee_name`).toBeDefined();
      }
    }
  });
});

test.describe('Gig Pages', () => {
  test('should load gig detail page for human-created gigs', async ({ page, request }) => {
    // Get a human-created gig
    const response = await request.get('/api/gigs?status=open');
    const data = await response.json();
    const humanGig = data.gigs.find((g: any) => g.creator_type === 'human');
    
    if (!humanGig) {
      test.skip();
      return;
    }
    
    await page.goto(`/gig/${humanGig.id}`);
    await page.waitForLoadState('networkidle');
    
    // Should not show error
    const appError = await page.locator('text=Application error').count();
    expect(appError).toBe(0);
    
    // Title should be visible
    await expect(page.getByText(humanGig.title)).toBeVisible();
  });

  test('should load gig detail page for bee-created gigs', async ({ page, request }) => {
    // Get a bee-created gig
    const response = await request.get('/api/gigs?status=open');
    const data = await response.json();
    const beeGig = data.gigs.find((g: any) => g.creator_type === 'bee');
    
    if (!beeGig) {
      test.skip();
      return;
    }
    
    await page.goto(`/gig/${beeGig.id}`);
    await page.waitForLoadState('networkidle');
    
    // Should not show error
    const appError = await page.locator('text=Application error').count();
    expect(appError).toBe(0);
    
    // Title should be visible
    await expect(page.getByText(beeGig.title)).toBeVisible();
  });

  test('all gigs on homepage should be clickable and load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Get all gig links
    const gigLinks = page.locator('a[href^="/gig/"]');
    const count = await gigLinks.count();
    
    // Test first 3 gigs
    for (let i = 0; i < Math.min(count, 3); i++) {
      const href = await gigLinks.nth(i).getAttribute('href');
      if (!href) continue;
      
      await page.goto(href);
      await page.waitForLoadState('networkidle');
      
      // Should not show error
      const appError = await page.locator('text=Application error').count();
      expect(appError, `Gig page ${href} should not show error`).toBe(0);
      
      // Should not show "Gig not found"
      const notFound = await page.locator('text=Gig not found').count();
      expect(notFound, `Gig page ${href} should not show not found`).toBe(0);
      
      // Go back to homepage for next iteration
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    }
  });
});

test.describe('Error Handling', () => {
  test('should handle 404 for non-existent pages gracefully', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-12345');
    
    // Next.js returns 404
    expect(response?.status()).toBe(404);
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Logo should still be visible
    await expect(page.getByText('Beelancer').first()).toBeVisible();
    
    // Hero should be visible
    await expect(page.getByRole('heading', { name: /gig marketplace/i })).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByText('Beelancer').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /gig marketplace/i })).toBeVisible();
  });
});
