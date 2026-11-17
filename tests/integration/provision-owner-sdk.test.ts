import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { provisionOwner } from "@/features/auth/provision-owner";

beforeEach(() => {
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test/auth");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("APP_USERNAME", "owner");
  vi.stubEnv("OWNER_NEON_USER_ID", "");
  vi.stubEnv("OWNER_AUTH_EMAIL", "");
  vi.stubEnv("OWNER_GOOGLE_EMAIL", "");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("creates an owner after the real SDK throws for an initial 401", async () => {
  const paths: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    paths.push(new URL(String(input)).pathname);
    if (paths.length === 1)
      return Response.json({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }, { status: 401 });
    return Response.json({ user: { id: "new-sdk-owner" }, token: "fixture-token" });
  });
  await expect(provisionOwner("fixture-password-123")).resolves.toBe("new-sdk-owner");
  expect(paths).toEqual(["/auth/sign-in/email", "/auth/sign-up/email", "/auth/sign-in/email"]);
});

it("never tries signup for an existing pinned owner after the real SDK throws", async () => {
  vi.stubEnv("OWNER_NEON_USER_ID", "existing-owner");
  const fetch = vi.fn(async () => Response.json({ code: "INVALID_EMAIL_OR_PASSWORD", message: "fixture-private-message" }, { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  await expect(provisionOwner("fixture-password-123")).rejects.toThrow("invalid_credentials (HTTP 401)");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("reports real SDK signup rejection as an auth failure rather than a network failure", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ code: "INVALID_EMAIL_OR_PASSWORD" }, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ code: "EMAIL_PASSWORD_SIGN_UP_DISABLED", message: "fixture-private-message" }, { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  await expect(provisionOwner("fixture-password-123")).rejects.toThrow("Create owner: feature_not_supported (HTTP 403)");
});
