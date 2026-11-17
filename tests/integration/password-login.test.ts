import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: () => ({ signIn: { email: m.signIn }, signOut: m.signOut }),
}));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: m.rateLimit }));
import { loginWithUsername } from "@/features/auth/login";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_USERNAME = "owner";
  process.env.OWNER_NEON_USER_ID = "neon-owner";
  delete process.env.OWNER_AUTH_EMAIL;
  delete process.env.OWNER_GOOGLE_EMAIL;
  process.env.NEXT_PUBLIC_APP_URL = "https://search.test";
  m.signIn.mockResolvedValue({
    data: { user: { id: "neon-owner" } },
    error: null,
  });
});
const request = (body: unknown, origin = "https://search.test") =>
  new Request("https://search.test/api/auth/login", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
it("maps username server-side and signs in using the official managed Auth API", async () => {
  await loginWithUsername(
    request({ username: "owner", password: "a-long-secret-password" }),
  );
  expect(m.signIn).toHaveBeenCalledWith({
    email: "owner@searchpilot.invalid",
    password: "a-long-secret-password",
  });
  expect(m.rateLimit).toHaveBeenCalled();
});
it("rejects cross-origin login before sending any password upstream", async () => {
  await expect(
    loginWithUsername(
      request(
        { username: "owner", password: "secret" },
        "https://attacker.test",
      ),
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.signIn).not.toHaveBeenCalled();
});
it("rejects an incorrect username and invalid bodies", async () => {
  await expect(
    loginWithUsername(request({ username: "other", password: "secret" })),
  ).rejects.toMatchObject({ status: 401 });
  await expect(
    loginWithUsername(request({ username: "owner", password: "" })),
  ).rejects.toThrow();
  expect(m.signIn).not.toHaveBeenCalled();
});
it("rejects an unpinned Neon identity and signs out its session", async () => {
  m.signIn.mockResolvedValue({
    data: { user: { id: "another-user" } },
    error: null,
  });
  await expect(
    loginWithUsername(request({ username: "owner", password: "secret" })),
  ).rejects.toMatchObject({ status: 401 });
  expect(m.signOut).toHaveBeenCalledOnce();
});
it("does not echo provider errors or submitted passwords", async () => {
  m.signIn.mockResolvedValue({
    data: null,
    error: { message: "provider details secret" },
  });
  await expect(
    loginWithUsername(request({ username: "owner", password: "do-not-log" })),
  ).rejects.toThrow("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
});
