import { afterEach, expect, it, vi } from "vitest";
import { oauthClient } from "@/lib/google/client";
afterEach(() => vi.unstubAllEnvs());
it("reports missing Google OAuth settings without exposing credentials", () => {
  vi.stubEnv("GOOGLE_GSC_CLIENT_ID", "fixture-client");
  vi.stubEnv("GOOGLE_GSC_CLIENT_SECRET", "fixture-private-secret");
  vi.stubEnv("GOOGLE_GSC_REDIRECT_URI", "");
  expect(oauthClient).toThrow("ยังไม่ได้ตั้งค่า Google OAuth");
  try { oauthClient(); } catch (error) {
    expect(error).toMatchObject({ status: 503 });
    expect((error as Error).message).not.toContain("fixture-private-secret");
  }
});
it("uses the configured callback in the Google authorization URL", () => {
  vi.stubEnv("GOOGLE_GSC_CLIENT_ID", "fixture-client");
  vi.stubEnv("GOOGLE_GSC_CLIENT_SECRET", "fixture-private-secret");
  vi.stubEnv("GOOGLE_GSC_REDIRECT_URI", "https://localhost:3000/api/google/callback");
  const url = new URL(oauthClient().generateAuthUrl({scope: "https://www.googleapis.com/auth/webmasters.readonly"}));
  expect(url.searchParams.get("redirect_uri")).toBe("https://localhost:3000/api/google/callback");
  expect(url.searchParams.get("client_id")).toBe("fixture-client");
  expect(url.href).not.toContain("fixture-private-secret");
});
