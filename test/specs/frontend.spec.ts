import { test, expect } from '@playwright/test';

test('homepage loads with trading terminal', async ({ page }) => {
  await page.goto('/');
  // FIN + ALLY text branding in header
  await expect(page.locator('text=FIN').first()).toBeVisible({ timeout: 10000 });
  // Also check for "AI TRADING TERMINAL" subtitle
  const terminal = page.locator('text=/TRADING TERMINAL/i');
  await expect(terminal.first()).toBeVisible({ timeout: 5000 });
});

test('cash balance shown on page after SSE connects', async ({ page }) => {
  await page.goto('/');
  // Wait for SSE to connect and portfolio data to load (cash or portfolio value)
  // The header shows PORTFOLIO VALUE and CASH
  await page.waitForTimeout(4000);
  // Look for any dollar amount in the header area
  const dollarAmount = page.locator('text=/\\$[0-9]+/').first();
  await expect(dollarAmount).toBeVisible({ timeout: 8000 });
});

test('watchlist shows default tickers', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=AAPL').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=GOOGL').first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=MSFT').first()).toBeVisible({ timeout: 5000 });
});

test('page has no critical JS errors on load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await page.waitForTimeout(3000);
  const criticalErrors = errors.filter(
    (e) =>
      !e.includes('NetworkError') &&
      !e.includes('Failed to fetch') &&
      !e.includes('net::ERR')
  );
  expect(criticalErrors).toHaveLength(0);
});

test('connection status indicator is present', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);

  // The header shows a colored dot + text "Connected" or "Disconnected" or "Reconnecting"
  const statusText = page.locator('text=/Connected|Disconnected|Reconnecting/i');
  await expect(statusText.first()).toBeVisible({ timeout: 5000 });
});

test('page renders prices after SSE connection', async ({ page }) => {
  await page.goto('/');
  // Wait for prices to start streaming — look for a price pattern like $XXX.XX
  await page.waitForTimeout(3000);
  const priceLocator = page.locator('text=/\\$[0-9]+\\.[0-9]{2}/');
  const count = await priceLocator.count();
  expect(count).toBeGreaterThan(0);
});
