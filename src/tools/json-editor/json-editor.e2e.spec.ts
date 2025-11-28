import { test, expect } from '@playwright/test';

test.describe('Tool - Json editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/json-editor');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Json editor - IT Tools');
  });

  test('', async ({ page }) => {

  });
});