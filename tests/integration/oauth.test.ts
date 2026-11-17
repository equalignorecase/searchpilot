import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  consume: vi.fn(),
  getToken: vi.fn(),
  getTokenInfo: vi.fn(),
  credential: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  db: () => ({
    $queryRaw: m.consume,
    googleCredential: { findUnique: m.credential, upsert: m.upsert },
  }),
}));
vi.mock("@/lib/google/client", () => ({
  GSC_SCOPE: "https://www.googleapis.com/auth/webmasters.readonly",
  oauthClient: () => ({ getToken: m.getToken, getTokenInfo: m.getTokenInfo }),
}));
import { exchangeOAuth } from "@/lib/google/oauth";
import { encrypt, decrypt } from "@/lib/security/encryption";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
    "base64",
  );
  m.consume.mockResolvedValue([
    { verifier: encrypt("pkce-verifier", "owner") },
  ]);
  m.getToken.mockResolvedValue({
    tokens: { access_token: "access", refresh_token: null },
  });
  m.getTokenInfo.mockResolvedValue({
    sub: "google-sub",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  m.credential.mockResolvedValue({
    googleAccountId: "google-sub",
    encryptedRefreshToken: encrypt("old-refresh", "owner"),
  });
});
it("retains and re-encrypts the same grant when no replacement refresh token arrives", async () => {
  await exchangeOAuth("owner", "state", "state", "code");
  const data = m.upsert.mock.calls[0][0];
  expect(decrypt(data.update.encryptedRefreshToken, "owner")).toBe(
    "old-refresh",
  );
  expect(data.update.tokenStatus).toBe("ACTIVE");
  expect(m.getToken).toHaveBeenCalledWith({
    code: "code",
    codeVerifier: "pkce-verifier",
  });
});
it("rejects browser state mismatch before consuming server state or exchanging code", async () => {
  await expect(
    exchangeOAuth("owner", "wrong", "state", "code"),
  ).rejects.toThrow("ข้อมูลยืนยันคำขอ OAuth ไม่ตรงกัน");
  expect(m.consume).not.toHaveBeenCalled();
  expect(m.getToken).not.toHaveBeenCalled();
});
it("rejects replayed or expired one-time states", async () => {
  m.consume.mockResolvedValue([]);
  await expect(
    exchangeOAuth("owner", "state", "state", "code"),
  ).rejects.toThrow("หมดอายุหรือถูกใช้แล้ว");
  expect(m.getToken).not.toHaveBeenCalled();
});
it("rejects missing Search Console scope and preserves the credential", async () => {
  m.getTokenInfo.mockResolvedValue({ sub: "google-sub", scopes: [] });
  await expect(
    exchangeOAuth("owner", "state", "state", "code"),
  ).rejects.toThrow("ต้องอนุญาตสิทธิ์อ่านข้อมูล Search Console");
  expect(m.upsert).not.toHaveBeenCalled();
});
it("does not reuse offline tokens from a different Google account", async () => {
  m.getTokenInfo.mockResolvedValue({
    sub: "other-google",
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  await expect(
    exchangeOAuth("owner", "state", "state", "code"),
  ).rejects.toThrow("สิทธิ์สำหรับการเข้าถึงเบื้องหลัง");
  expect(m.upsert).not.toHaveBeenCalled();
});
