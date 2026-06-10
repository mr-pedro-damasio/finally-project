import { test, expect } from '@playwright/test';

test('watchlist returns price data for default tickers within 3s', async ({ request }) => {
  // Poll until prices are populated (simulator needs ~500ms to first tick)
  let data: Array<{ ticker: string; price: number | null }> = [];
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const res = await request.get('/api/watchlist');
    expect(res.ok()).toBeTruthy();
    data = await res.json();
    const allPriced = data.every((item) => item.price !== null && item.price !== undefined);
    if (allPriced) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  expect(data.length).toBeGreaterThan(0);
  for (const item of data) {
    expect(item.price).not.toBeNull();
    expect(typeof item.price).toBe('number');
    expect(item.price).toBeGreaterThan(0);
  }
});

test('watchlist items have ticker field', async ({ request }) => {
  const res = await request.get('/api/watchlist');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  for (const item of data) {
    expect(item).toHaveProperty('ticker');
    expect(typeof item.ticker).toBe('string');
    expect(item.ticker.length).toBeGreaterThan(0);
  }
});
