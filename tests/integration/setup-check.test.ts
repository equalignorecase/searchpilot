import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
it("reports missing setup safely without printing secrets or calling external services", () => {
  const result = spawnSync("npm", ["run", "check:setup"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 15000,
    env: {
      ...process.env,
      DATABASE_URL: "",
      DATABASE_URL_UNPOOLED: "",
      NEON_AUTH_BASE_URL: "",
      NEON_AUTH_COOKIE_SECRET: "must-not-print-this-secret",
      OWNER_GOOGLE_EMAIL: "",
      GOOGLE_GSC_CLIENT_SECRET: "must-not-print-this-secret",
      CRON_SECRET: "",
    },
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Missing or invalid configuration");
  expect(result.stderr + result.stdout).not.toContain(
    "must-not-print-this-secret",
  );
});
