import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "*.spec.ts",
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3046",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next build tests/browser/fixture --webpack && node node_modules/next/dist/bin/next start tests/browser/fixture --hostname 127.0.0.1 --port 3046",
    url: "http://127.0.0.1:3046",
    reuseExistingServer: false,
    stdout: "pipe",
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
