import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * Everything else in this repo tests a *piece*: an engine in isolation, a
 * component in jsdom, a Cloud Function called directly. This suite is the only
 * one where the real bundled application starts up and talks to a real Firebase
 * backend — security rules, transaction and all.
 *
 * It runs against the Expo **web** build. That is not the same as a device, and
 * the limitation is stated plainly in docs/ROADMAP.md: gesture handling, native
 * keyboard behaviour and real animation timing still go unverified. What it
 * does prove is that the app boots, that navigation and state wiring hold
 * together, and that a full game round-trips through auth, Firestore rules and
 * `submitGameResult` — none of which any other suite can see.
 *
 * `npm run test:e2e` builds the bundle, starts the emulators, serves the
 * bundle and runs this suite, then tears it all down.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // The emulator suite is shared state; parallel workers would fight over it.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  timeout: 90_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  // Serves the exported web bundle. Playwright starts it, waits for it to
  // answer, and tears it down — the emulators are started around all of this by
  // `scripts/e2e.sh`.
  webServer: {
    command: 'npx serve dist --listen 8081 --single --no-clipboard',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Pixel 7'],
        // Use a pre-installed Chromium when the environment provides one
        // (CHROMIUM_EXECUTABLE_PATH), rather than downloading a build that has
        // to match this Playwright version exactly. CI falls back to
        // `playwright install --with-deps chromium`.
        launchOptions: {
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
          ...(process.env.CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
            : {}),
        },
      },
    },
  ],
});
