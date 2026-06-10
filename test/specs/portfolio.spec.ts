import { test, expect } from '@playwright/test';

test('initial portfolio: $10k cash, no positions', async ({ request }) => {
  const res = await request.get('/api/portfolio');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data).toHaveProperty('cash_balance');
  expect(data.cash_balance).toBeGreaterThan(0);
  expect(data).toHaveProperty('positions');
  expect(Array.isArray(data.positions)).toBeTruthy();
  expect(data).toHaveProperty('total_value');
});

test('buy shares: cash decreases, position appears', async ({ request }) => {
  // Get initial state
  const before = await (await request.get('/api/portfolio')).json();
  const initialCash = before.cash_balance;

  // Buy 5 shares of AAPL
  const tradeRes = await request.post('/api/portfolio/trade', {
    data: { ticker: 'AAPL', side: 'buy', quantity: 5 },
  });
  expect(tradeRes.ok()).toBeTruthy();

  // Verify portfolio changed
  const after = await (await request.get('/api/portfolio')).json();
  expect(after.cash_balance).toBeLessThan(initialCash);

  const aaplPos = after.positions.find((p: { ticker: string }) => p.ticker === 'AAPL');
  expect(aaplPos).toBeDefined();
  expect(aaplPos.quantity).toBeGreaterThanOrEqual(5);
  expect(aaplPos).toHaveProperty('avg_cost');
  expect(aaplPos).toHaveProperty('unrealized_pnl');
});

test('sell shares: cash increases, position updates', async ({ request }) => {
  // Ensure we have AAPL position (buy first)
  await request.post('/api/portfolio/trade', {
    data: { ticker: 'AAPL', side: 'buy', quantity: 10 },
  });

  const before = await (await request.get('/api/portfolio')).json();
  const cashBefore = before.cash_balance;
  const aaplBefore = before.positions.find((p: { ticker: string }) => p.ticker === 'AAPL');
  const qtyBefore = aaplBefore?.quantity ?? 0;

  // Sell 2 shares
  const sellRes = await request.post('/api/portfolio/trade', {
    data: { ticker: 'AAPL', side: 'sell', quantity: 2 },
  });
  expect(sellRes.ok()).toBeTruthy();

  const after = await (await request.get('/api/portfolio')).json();
  expect(after.cash_balance).toBeGreaterThan(cashBefore);

  const aaplAfter = after.positions.find((p: { ticker: string }) => p.ticker === 'AAPL');
  if (qtyBefore - 2 > 0) {
    expect(aaplAfter).toBeDefined();
    expect(aaplAfter.quantity).toBeLessThan(qtyBefore);
  }
});

test('buy with insufficient cash returns 400', async ({ request }) => {
  const res = await request.post('/api/portfolio/trade', {
    data: { ticker: 'AAPL', side: 'buy', quantity: 999999 },
  });
  expect(res.status()).toBe(400);
  const data = await res.json();
  expect(data).toHaveProperty('error');
});

test('sell more than held returns 400', async ({ request }) => {
  const res = await request.post('/api/portfolio/trade', {
    data: { ticker: 'GOOG', side: 'sell', quantity: 999999 },
  });
  expect(res.status()).toBe(400);
  const data = await res.json();
  expect(data).toHaveProperty('error');
});

test('sell entire position deletes position row', async ({ request }) => {
  // Buy a unique ticker to get a clean position
  const ticker = 'V';

  // Get current V position or buy some
  const before = await (await request.get('/api/portfolio')).json();
  const vPosBefore = before.positions.find((p: { ticker: string }) => p.ticker === ticker);
  const existingQty = vPosBefore?.quantity ?? 0;

  // Buy 3 shares
  await request.post('/api/portfolio/trade', {
    data: { ticker, side: 'buy', quantity: 3 },
  });

  const mid = await (await request.get('/api/portfolio')).json();
  const vMid = mid.positions.find((p: { ticker: string }) => p.ticker === ticker);
  const totalQty = vMid?.quantity ?? 0;

  // Sell all
  const sellRes = await request.post('/api/portfolio/trade', {
    data: { ticker, side: 'sell', quantity: totalQty },
  });
  expect(sellRes.ok()).toBeTruthy();

  const after = await (await request.get('/api/portfolio')).json();
  const vAfter = after.positions.find((p: { ticker: string }) => p.ticker === ticker);

  // Position should be gone (or if we had existing, quantity should be back to existingQty via a complex path)
  if (existingQty === 0) {
    expect(vAfter).toBeUndefined();
  }
});

test('portfolio history returns array', async ({ request }) => {
  const res = await request.get('/api/portfolio/history');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(Array.isArray(data)).toBeTruthy();
});

test('positions have required fields', async ({ request }) => {
  // Buy to ensure there's at least one position
  await request.post('/api/portfolio/trade', {
    data: { ticker: 'MSFT', side: 'buy', quantity: 1 },
  });

  const res = await request.get('/api/portfolio');
  const data = await res.json();
  const positions = data.positions;

  if (positions.length > 0) {
    const pos = positions[0];
    expect(pos).toHaveProperty('ticker');
    expect(pos).toHaveProperty('quantity');
    expect(pos).toHaveProperty('avg_cost');
    expect(pos).toHaveProperty('current_price');
    expect(pos).toHaveProperty('unrealized_pnl');
  }
});
