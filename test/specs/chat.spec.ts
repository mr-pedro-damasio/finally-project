import { test, expect } from '@playwright/test';

test('GET /api/chat/history returns array', async ({ request }) => {
  const res = await request.get('/api/chat/history');
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(Array.isArray(data)).toBeTruthy();
});

test('POST /api/chat returns 200 with required fields', async ({ request }) => {
  const res = await request.post('/api/chat', {
    data: { message: 'hello' },
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty('message');
  expect(typeof data.message).toBe('string');
  expect(data).toHaveProperty('trades');
  expect(Array.isArray(data.trades)).toBeTruthy();
  expect(data).toHaveProperty('watchlist_changes');
  expect(Array.isArray(data.watchlist_changes)).toBeTruthy();
  expect(data).toHaveProperty('trade_results');
  expect(Array.isArray(data.trade_results)).toBeTruthy();
});

test('mock LLM returns deterministic response', async ({ request }) => {
  const res = await request.post('/api/chat', {
    data: { message: 'hello' },
  });
  const data = await res.json();
  // LLM_MOCK=true should return this exact message
  expect(data.message).toBe('Mock response: your portfolio looks balanced.');
});

test('after chat, history has user and assistant messages', async ({ request }) => {
  // Send a message
  await request.post('/api/chat', { data: { message: 'test message for history check' } });

  const histRes = await request.get('/api/chat/history');
  const history = await histRes.json();
  expect(history.length).toBeGreaterThanOrEqual(2);

  const roles = history.map((m: { role: string }) => m.role);
  expect(roles).toContain('user');
  expect(roles).toContain('assistant');
});

test('chat history messages have required fields', async ({ request }) => {
  await request.post('/api/chat', { data: { message: 'ping' } });

  const histRes = await request.get('/api/chat/history');
  const history = await histRes.json();

  for (const msg of history) {
    expect(msg).toHaveProperty('role');
    expect(msg).toHaveProperty('content');
    expect(['user', 'assistant']).toContain(msg.role);
  }
});
