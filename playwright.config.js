import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright drives the REAL page. That is the whole point of rungs 3 and 4: a layout claim
 * that has not met a browser is a guess.
 *
 * `webServer` starts the app itself, so `npm test` works from a cold clone with no second
 * terminal. Screenshot comparison is deliberately not configured; see the
 * `verify-in-the-browser` skill for why golden images are the rung this repo does not ship.
 */
export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: 'http://localhost:4318',
        viewport: { width: 1280, height: 800 },
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'node scripts/serve.mjs',
        url: 'http://localhost:4318',
        env: { PORT: '4318' },
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
