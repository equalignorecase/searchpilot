import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  factory: vi.fn(),
}));
vi.mock("@neondatabase/auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@neondatabase/auth")>(),
  createAuthClient: m.factory,
}));
import { provisionOwner } from "@/features/auth/provision-owner";
beforeEach(() => {
  vi.clearAllMocks();
  m.factory.mockReturnValue({
    signIn: { email: m.signIn },
    signUp: { email: m.signUp },
  });
  process.env.NEON_AUTH_BASE_URL = "https://auth.example.test/auth";
  process.env.NEXT_PUBLIC_APP_URL = "https://search.test";
  process.env.APP_USERNAME = "owner";
  delete process.env.OWNER_NEON_USER_ID;
  delete process.env.OWNER_AUTH_EMAIL;
  delete process.env.OWNER_GOOGLE_EMAIL;
  m.signIn.mockResolvedValue({
    data: { user: { id: "neon-owner" } },
    error: null,
  });
});
it("reuses an existing authenticated owner without storing the password", async () => {
  expect(await provisionOwner("long-password-123")).toBe("neon-owner");
  expect(m.signUp).not.toHaveBeenCalled();
});
it("creates an internal login identifier then verifies password sign-in", async () => {
  m.signIn
    .mockResolvedValueOnce({ error: { message: "unknown" } })
    .mockResolvedValueOnce({
      data: { user: { id: "new-owner" } },
      error: null,
    });
  m.signUp.mockResolvedValue({
    data: { user: { id: "new-owner" } },
    error: null,
  });
  expect(await provisionOwner("long-password-123")).toBe("new-owner");
  expect(m.signUp).toHaveBeenCalledWith(
    {
      email: "owner@searchpilot.invalid",
      password: "long-password-123",
      name: "owner",
    },
    expect.anything(),
  );
});
it("never replaces a pinned owner or creates accounts when its password fails", async () => {
  process.env.OWNER_NEON_USER_ID = "existing-owner";
  m.signIn.mockResolvedValue({
    data: null,
    error: { message: "wrong password" },
  });
  await expect(provisionOwner("long-password-123")).rejects.toThrow();
  expect(m.signUp).not.toHaveBeenCalled();
  m.signIn.mockResolvedValue({
    data: { user: { id: "other-owner" } },
    error: null,
  });
  await expect(provisionOwner("long-password-123")).rejects.toThrow("pinned");
});
it("validates passwords before contacting Neon and requires a working managed session", async () => {
  await expect(provisionOwner("short")).rejects.toThrow();
  expect(m.factory).not.toHaveBeenCalled();
  m.signIn.mockResolvedValue({
    data: null,
    error: { message: "email verification required" },
  });
  m.signUp.mockResolvedValue({
    data: { user: { id: "new-owner" } },
    error: null,
  });
  await expect(provisionOwner("long-password-123")).rejects.toThrow(
    "email/password",
  );
});
it("reports password validation without disclosing its value", async () => {
  await expect(provisionOwner("short")).rejects.toThrow("Password must contain 12-128 characters");
});
it("reports the creation stage and a safe provider code without its raw message", async () => {
  m.signIn.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  m.signUp.mockResolvedValue({ error: { code: "SIGN_UP_DISABLED", status: 403, message: "secret-password" } });
  await expect(provisionOwner("long-password-123")).rejects.toThrow("Create owner: SIGN_UP_DISABLED (HTTP 403)");
});
it("reports blocked origin during sign-in without trying to create an owner", async () => {
  m.signIn.mockResolvedValue({ error: { code: "INVALID_ORIGIN", status: 403 } });
  await expect(provisionOwner("long-password-123")).rejects.toThrow("Sign in: INVALID_ORIGIN (HTTP 403)");
  expect(m.signUp).not.toHaveBeenCalled();
});
it("reports network errors without leaking underlying request details", async () => {
  m.signIn.mockRejectedValue(new Error("secret-password in request"));
  await expect(provisionOwner("long-password-123")).rejects.toThrow("Could not reach Neon Auth");
});
it("never prints raw provider messages or unrecognized provider codes", async () => {
  m.signIn.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  m.signUp.mockResolvedValue({ error: { code: "SECRET_PASSWORD", status: 500, message: "secret-password" } });
  const error = await provisionOwner("long-password-123").catch((error: Error) => error);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe("Create owner: AUTH_REQUEST_FAILED (HTTP 500). Check Neon Auth settings and service availability.");
});
