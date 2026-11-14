import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the real API. Start the backend first:
//   cd server && .venv/Scripts/python.exe -m app.operators seed-demo --password demo-pass-123   (operator.spec.ts)
//   cd server && uvicorn app.main:app --port 8000
const PORT = process.env.WEB_PORT ?? '5173' // set WEB_PORT when another dev server already owns 5173
export default defineConfig({
  testDir: 'e2e',
  reporter: [['list']],
  timeout: 45_000,
  // /api/search takes ~2.5 s per call even on the keyword fallback, more with the LLM.
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: `npm run dev -- --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: true },
})
