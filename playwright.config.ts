import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, TEST_SECRET } from "./tests/e2e/fixtures";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: BASE_URL, colorScheme: "light", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3100",
    url: BASE_URL + "/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/searchpilot_e2e",
      DATABASE_URL_UNPOOLED:
        "postgresql://test:test@localhost:5432/searchpilot_e2e",
      GOOGLE_GSC_CLIENT_ID: "e2e-not-a-real-client",
      GOOGLE_GSC_CLIENT_SECRET: "e2e-not-a-real-secret",
      GOOGLE_GSC_REDIRECT_URI: BASE_URL + "/api/google/callback",
      GOOGLE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      CRON_SECRET: "searchpilot-e2e-only-cron-secret-0123456789",
      NEON_AUTH_BASE_URL: "http://127.0.0.1:3199/auth",
      NEON_AUTH_COOKIE_SECRET: TEST_SECRET,
      APP_USERNAME: "owner",
      OWNER_AUTH_EMAIL: "owner@searchpilot.invalid",
      OWNER_GOOGLE_EMAIL: "",
      OWNER_NEON_USER_ID: "test-owner",
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
});
