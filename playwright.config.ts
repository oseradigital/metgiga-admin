import { defineConfig, devices } from "@playwright/test";

// Runs against a real local dev server backed by the SAME shared
// Supabase project the deployed app will use — same discipline as
// metgiga-portal's suite: every test creates its own throwaway team
// member / organisation / deal / task via the admin client and cleans
// up afterward (see e2e/helpers.ts), nothing is left behind.
//
// Single chromium project for this pass — the ask was specifically
// "critical paths before deployment" (login, RLS boundaries, pipeline
// moves), not cross-browser coverage. Mobile/webkit projects are a
// cheap addition later, same as how the portal added webkit in its
// second QA pass, not its first.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shared Supabase project — avoid cross-test row contention
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3010",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- -p 3010",
    url: "http://localhost:3010",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
