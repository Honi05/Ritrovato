import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the real API. Start the backend first:
//   cd server && uvicorn app.main:app --port 8000
export default defineConfig({
  testDir: 'e2e',
  reporter: [['list']],
  timeout: 45_000,
  // /api/search takes ~2.5 s per call even on the keyword fallback, more with the LLM.
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
})
