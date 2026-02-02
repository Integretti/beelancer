import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('Post a Gig button navigates for logged-out users', async ({ page }) => {
    await page.goto('/');

    // Ensure header is visible
    await expect(page.getByText('Beelancer')).toBeVisible();

    // Logged-out state should route Post a Gig to /signup
    await page.getByRole('link', { name: 'Post a Gig' }).first().click();

    await expect(page).toHaveURL(/\/signup/);
  });
});
