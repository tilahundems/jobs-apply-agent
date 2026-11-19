import { defineConfig, devices } from "playwright/test"

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3000",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node ../api/dist/main.js",
      url: "http://localhost:4000/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js dev --host localhost --strictPort",
      url: "http://localhost:3000/login",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
