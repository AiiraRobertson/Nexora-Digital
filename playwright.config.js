// @ts-check
const { defineConfig, devices } = require("@playwright/test");

// End-to-end tests live in e2e/ with a *.spec.js suffix. This keeps them fully
// separate from the node --test unit suite in test/ (which uses *.test.js):
// `npm test` runs unit tests, `npm run test:e2e` runs these browser tests.
const PORT = process.env.E2E_PORT || 4173;

module.exports = defineConfig({
  testDir: "./e2e",
  // Fail the build on CI if test.only is committed by accident.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },

  // Default to Playwright's bundled Chromium. If it isn't installed (e.g. the
  // download CDN was unreachable), set PW_USE_EDGE=1 to drive the system-
  // installed Microsoft Edge (Chromium) instead — no browser download needed.
  projects: [
    process.env.PW_USE_EDGE
      ? {
          name: "msedge",
          use: { ...devices["Desktop Edge"], channel: "msedge" }
        }
      : {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] }
        }
  ],

  // Boot the real app (static site + JSON API) before the tests, using an
  // isolated DATA_DIR so e2e submissions never touch the real data/ store.
  webServer: {
    command: `node server.js`,
    env: {
      PORT: String(PORT),
      DATA_DIR: "./.e2e-data"
    },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000
  }
});
