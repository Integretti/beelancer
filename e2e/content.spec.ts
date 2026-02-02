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
    }
  });
});

test.describe('Gig Pages', () => {
  test('should load gig detail page', async ({ page, request }) => {
    // Get any gig
    const response = await request.get('/api/gigs?status=open');
    const data = await response.json();
    
    if (!data.gigs || data.gigs.length === 0) {
      test.skip();
      return;
    }
    
    const gig = data.gigs[0];
    await page.goto(`/gig/${gig.id}`);
    await page.waitForLoadState('networkidle');
    
    // Should not show error
    const appError = await page.locator('text=Application error').count();
    expect(appError).toBe(0);
    
    // Title should be visible
    await expect(page.getByText(gig.title)).toBeVisible();
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

test.describe('Layout & Navigation', () => {
  
  test.describe('Header', () => {
    test('Header shows logo and brand', async ({ page }) => {
      await page.goto('/');
      
      await expect(page.getByText('Beelancer')).toBeVisible();
      await expect(page.getByText('🐝')).toBeVisible();
      await expect(page.getByText('Beta')).toBeVisible();
    });

    test('X/Twitter link is next to logo', async ({ page }) => {
      await page.goto('/');
      
      // Find the header area with logo
      const header = page.locator('header');
      
      // X link should be in the left section (with logo)
      const logoSection = header.locator('div').first();
      const xLink = logoSection.locator('a[href*="x.com/beelancerai"]');
      
      await expect(xLink).toBeVisible();
    });

    test('Learn link is visible in navigation', async ({ page }) => {
      await page.goto('/');
      
      // On desktop
      await expect(page.getByRole('link', { name: /Learn/i })).toBeVisible();
    });

    test('Leaderboard link is visible in navigation', async ({ page }) => {
      await page.goto('/');
      
      await expect(page.getByRole('link', { name: /Leaderboard/i })).toBeVisible();
    });

    test('Navigation links work', async ({ page }) => {
      await page.goto('/');
      
      // Click Learn link
      await page.getByRole('link', { name: /Learn/i }).click();
      await expect(page).toHaveURL(/blog/);
      
      // Go back and click Leaderboard
      await page.goto('/');
      await page.getByRole('link', { name: /Leaderboard/i }).click();
      await expect(page).toHaveURL(/leaderboard/);
    });

    test('Login/Signup links visible when not authenticated', async ({ page }) => {
      await page.goto('/');
      
      await expect(page.getByRole('link', { name: /Login/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Post a Gig|Sign Up/i })).toBeVisible();
    });
  });

  test.describe('Footer', () => {
    test('Footer shows correct brand text', async ({ page }) => {
      await page.goto('/');
      
      const footer = page.locator('footer');
      
      // Check for "AI" (capitalized)
      await expect(footer.getByText(/where AI agents/i)).toBeVisible();
      
      // Check for human help credit
      await expect(footer.getByText(/human help from/i)).toBeVisible();
      await expect(footer.getByText('@nicolageretti')).toBeVisible();
    });

    test('Footer has sitemap sections', async ({ page }) => {
      await page.goto('/');
      
      const footer = page.locator('footer');
      
      // Check for section headers
      await expect(footer.getByText('For Bees')).toBeVisible();
      await expect(footer.getByText('For Humans')).toBeVisible();
      await expect(footer.getByText('Community')).toBeVisible();
      await expect(footer.getByText('Legal')).toBeVisible();
    });

    test('Footer links work', async ({ page }) => {
      await page.goto('/');
      
      // Test a few footer links
      const footerLinks = [
        { name: 'Get Started', url: '/getting-started' },
        { name: 'API Docs', url: '/docs' },
        { name: 'Terms of Service', url: '/terms' },
        { name: 'Privacy Policy', url: '/privacy' },
      ];
      
      for (const { name, url } of footerLinks) {
        const link = page.locator('footer').getByRole('link', { name });
        await expect(link).toHaveAttribute('href', url);
      }
    });

    test('External links open in new tab', async ({ page }) => {
      await page.goto('/');
      
      // Check X/Twitter link
      const xLink = page.locator('footer a[href*="x.com/beelancerai"]');
      if (await xLink.count() > 0) {
        await expect(xLink).toHaveAttribute('target', '_blank');
      }
      
      // Check OpenClaw link
      const openClawLink = page.locator('footer a[href*="openclaw.ai"]');
      if (await openClawLink.count() > 0) {
        await expect(openClawLink).toHaveAttribute('target', '_blank');
      }
    });
  });

  test.describe('Mobile Menu', () => {
    test('Mobile menu button appears on small screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Menu button should be visible
      const menuButton = page.locator('button[aria-label="Toggle menu"]');
      await expect(menuButton).toBeVisible();
    });

    test('Mobile menu opens and shows navigation', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Click menu button
      await page.locator('button[aria-label="Toggle menu"]').click();
      
      // Navigation links should appear
      await expect(page.getByText('Beelancer University')).toBeVisible();
      await expect(page.getByText('Leaderboard')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('Homepage renders correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Content should be visible
      await expect(page.getByText('Beelancer')).toBeVisible();
      await expect(page.locator('body')).toBeVisible();
    });

    test('Homepage renders correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      
      await expect(page.getByText('Beelancer')).toBeVisible();
    });

    test('Homepage renders correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      
      await expect(page.getByText('Beelancer')).toBeVisible();
      // Desktop nav should be visible
      await expect(page.getByRole('link', { name: /Learn/i })).toBeVisible();
    });
  });
});

test.describe('Documentation & Skill Files', () => {
  
  test.describe('Skill.md', () => {
    test('GET /skill.md returns markdown content', async ({ request }) => {
      const response = await request.get('/skill.md');
      
      expect(response.ok()).toBeTruthy();
      
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('markdown');
      
      const content = await response.text();
      expect(content).toContain('Beelancer');
      expect(content).toContain('/api/');
    });

    test('skill.md contains required sections', async ({ request }) => {
      const response = await request.get('/skill.md');
      const content = await response.text();
      
      // Check for essential sections
      expect(content).toContain('Quick Start');
      expect(content).toContain('register');
      expect(content).toContain('assignments');
      expect(content).toContain('gigs');
    });

    test('skill.md contains polling guidance', async ({ request }) => {
      const response = await request.get('/skill.md');
      const content = await response.text();
      
      expect(content).toContain('Poll');
      expect(content).toContain('30');
      expect(content).toContain('IDLE');
    });

    test('skill.md contains completed gig warning', async ({ request }) => {
      const response = await request.get('/skill.md');
      const content = await response.text();
      
      expect(content).toContain('Completed Gigs');
      expect(content).toContain('CLOSED');
      expect(content).toContain('Move on');
    });

    test('skill.md contains learning section', async ({ request }) => {
      const response = await request.get('/skill.md');
      const content = await response.text();
      
      expect(content).toContain('University');
      expect(content).toContain('Memory');
      expect(content).toContain('for_agents=true');
    });
  });

  test.describe('Heartbeat.md', () => {
    test('GET /heartbeat.md returns markdown content', async ({ request }) => {
      const response = await request.get('/heartbeat.md');
      
      expect(response.ok()).toBeTruthy();
      
      const content = await response.text();
      expect(content).toContain('Heartbeat');
    });

    test('heartbeat.md contains polling frequency table', async ({ request }) => {
      const response = await request.get('/heartbeat.md');
      const content = await response.text();
      
      expect(content).toContain('Active gig');
      expect(content).toContain('Pending bids');
      expect(content).toContain('30');
    });

    test('heartbeat.md contains action checklist', async ({ request }) => {
      const response = await request.get('/heartbeat.md');
      const content = await response.text();
      
      expect(content).toContain('assignments');
      expect(content).toContain('gigs');
    });
  });

  test.describe('Getting Started Page', () => {
    test('Getting started page loads', async ({ page }) => {
      await page.goto('/getting-started');
      
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('Getting started page has bee registration info', async ({ page }) => {
      await page.goto('/getting-started');
      
      await expect(page.getByText(/register/i)).toBeVisible();
      await expect(page.getByText(/API/i)).toBeVisible();
    });
  });

  test.describe('Docs Page', () => {
    test('Docs page loads', async ({ page }) => {
      await page.goto('/docs');
      
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('Docs page has API reference', async ({ page }) => {
      await page.goto('/docs');
      
      await expect(page.getByText(/API/i)).toBeVisible();
      await expect(page.getByText(/endpoint/i)).toBeVisible();
    });
  });

  test.describe('Code of Conduct', () => {
    test('Conduct page loads', async ({ page }) => {
      await page.goto('/conduct');
      
      await expect(page.locator('body')).toContainText(/conduct|rules|behavior/i);
    });
  });

  test.describe('Legal Pages', () => {
    test('Terms page loads', async ({ page }) => {
      await page.goto('/terms');
      
      await expect(page.locator('body')).toContainText(/terms|service/i);
    });

    test('Privacy page loads', async ({ page }) => {
      await page.goto('/privacy');
      
      await expect(page.locator('body')).toContainText(/privacy|data/i);
    });
  });
});

test.describe('Blog/University System', () => {
  
  test.describe('Blog API', () => {
    test('GET /api/blog returns list of published posts', async ({ request }) => {
      const response = await request.get('/api/blog');
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      
      // Check first post has required fields
      const post = data[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('slug');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('category');
      expect(post).toHaveProperty('read_time_minutes');
    });

    test('GET /api/blog?for_agents=true returns structured learning content', async ({ request }) => {
      const response = await request.get('/api/blog?for_agents=true');
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      expect(data.message).toContain('Beelancer University');
      expect(data.categories).toBeDefined();
      expect(data.categories).toHaveProperty('learning');
      expect(data.categories).toHaveProperty('skills');
      expect(data.posts).toBeDefined();
      expect(Array.isArray(data.posts)).toBe(true);
      
      // Posts should have full content in this mode
      if (data.posts.length > 0) {
        expect(data.posts[0]).toHaveProperty('content');
      }
    });

    test('GET /api/blog?category=learning filters by category', async ({ request }) => {
      const response = await request.get('/api/blog?category=learning');
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      for (const post of data) {
        expect(post.category).toBe('learning');
      }
    });

    test('GET /api/blog?featured=true returns only featured posts', async ({ request }) => {
      const response = await request.get('/api/blog?featured=true');
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      
      for (const post of data) {
        expect(post.featured).toBe(true);
      }
    });

    test('GET /api/blog/:slug returns single post with content', async ({ request }) => {
      // First get list to find a valid slug
      const listResponse = await request.get('/api/blog');
      const posts = await listResponse.json();
      
      if (posts.length === 0) {
        test.skip();
        return;
      }
      
      const slug = posts[0].slug;
      const response = await request.get(`/api/blog/${slug}`);
      
      expect(response.ok()).toBeTruthy();
      const post = await response.json();
      
      expect(post.slug).toBe(slug);
      expect(post.content).toBeDefined();
      expect(post.content.length).toBeGreaterThan(100);
      expect(post.related).toBeDefined();
      expect(Array.isArray(post.related)).toBe(true);
    });

    test('GET /api/blog/:slug returns 404 for non-existent post', async ({ request }) => {
      const response = await request.get('/api/blog/non-existent-slug-12345');
      
      expect(response.status()).toBe(404);
    });

    test('how-agents-learn post exists and has meaningful content', async ({ request }) => {
      const response = await request.get('/api/blog/how-agents-learn');
      
      expect(response.ok()).toBeTruthy();
      const post = await response.json();
      
      expect(post.title).toContain('Learn');
      expect(post.category).toBe('learning');
      expect(post.content).toContain('Memory');
      expect(post.content).toContain('Feedback');
    });
  });

  test.describe('Blog UI', () => {
    test('Blog page loads and shows posts', async ({ page }) => {
      await page.goto('/blog');
      
      // Check header
      await expect(page.getByText('Beelancer University')).toBeVisible();
      
      // Check for category filters
      await expect(page.getByRole('button', { name: /All/i })).toBeVisible();
      
      // Check for at least one post
      await expect(page.locator('a[href^="/blog/"]').first()).toBeVisible();
    });

    test('Blog post page renders markdown content', async ({ page }) => {
      await page.goto('/blog/how-agents-learn');
      
      // Check title is displayed
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/Learn/i);
      
      // Check content is rendered
      await expect(page.getByText('Memory')).toBeVisible();
      
      // Check for agent-readable notice
      await expect(page.getByText('For Agents')).toBeVisible();
    });

    test('Blog category filter works', async ({ page }) => {
      await page.goto('/blog');
      
      // Click learning category
      await page.getByRole('button', { name: /Learning/i }).click();
      
      // Wait for filter to apply
      await page.waitForTimeout(500);
      
      // URL should have category (if using URL params) or content should filter
      // Check that posts are visible
      const posts = page.locator('a[href^="/blog/"]');
      await expect(posts.first()).toBeVisible();
    });
  });
});
