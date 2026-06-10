import { test, expect } from '@playwright/test';

const DEFAULT_TICKERS = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'NFLX'];

test('default watchlist has 10 tickers', async ({ request }) => {
  const res = await request.get('/api/watchlist');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(Array.isArray(data)).toBeTruthy();
  expect(data.length).toBe(10);
  const tickers = data.map((item: { ticker: string }) => item.ticker);
  for (const ticker of DEFAULT_TICKERS) {
    expect(tickers).toContain(ticker);
  }
});

test('add a ticker and verify it appears', async ({ request }) => {
  // Add a unique test ticker
  const testTicker = 'PYPL';
  const addRes = await request.post('/api/watchlist', {
    data: { ticker: testTicker },
  });
  expect(addRes.ok()).toBeTruthy();

  // Verify it appears in GET
  const getRes = await request.get('/api/watchlist');
  const data = await getRes.json();
  const tickers = data.map((item: { ticker: string }) => item.ticker);
  expect(tickers).toContain(testTicker);

  // Cleanup: remove the test ticker
  await request.delete(`/api/watchlist/${testTicker}`);
});

test('add duplicate ticker returns 400', async ({ request }) => {
  const res = await request.post('/api/watchlist', {
    data: { ticker: 'AAPL' },
  });
  expect(res.status()).toBe(400);
  const data = await res.json();
  expect(data).toHaveProperty('error');
});

test('delete ticker returns 200 and removes it', async ({ request }) => {
  // Add a ticker to delete
  const ticker = 'NKLA';
  await request.post('/api/watchlist', { data: { ticker } });

  const delRes = await request.delete(`/api/watchlist/${ticker}`);
  expect(delRes.status()).toBe(200);

  // Verify it's gone
  const getRes = await request.get('/api/watchlist');
  const data = await getRes.json();
  const tickers = data.map((item: { ticker: string }) => item.ticker);
  expect(tickers).not.toContain(ticker);
});

test('delete non-existent ticker returns 200 (idempotent)', async ({ request }) => {
  const res = await request.delete('/api/watchlist/FAKEXYZ123');
  expect(res.status()).toBe(200);
});

test('add ticker normalizes to uppercase', async ({ request }) => {
  const addRes = await request.post('/api/watchlist', {
    data: { ticker: 'abnb' },
  });
  expect(addRes.ok()).toBeTruthy();

  const getRes = await request.get('/api/watchlist');
  const data = await getRes.json();
  const tickers = data.map((item: { ticker: string }) => item.ticker);
  expect(tickers).toContain('ABNB');

  // Cleanup
  await request.delete('/api/watchlist/ABNB');
});
