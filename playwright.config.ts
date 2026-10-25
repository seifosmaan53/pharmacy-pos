import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./e2e/db";

const PORT = 3100;

// Browser tests run against a production build (`npm run build` first) served
// by `next start`, backed by a throwaway SQLite database that e2e/setup-db.ts
// recreates and seeds on every run.
export default defineConfig({
  testDir: "./e2e",
  // One shared database, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx tsx e2e/setup-db.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      SESSION_SECRET: "e2e-only-value-not-a-secret-00000000000000000",
    },
  },
});
