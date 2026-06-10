import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8001',
    headless: true,
  },
  reporter: 'list',
});
