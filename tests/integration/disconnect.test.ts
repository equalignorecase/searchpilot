import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  credential: vi.fn(),
  revoke: vi.fn(),
  remove: vi.fn(),
  cancel: vi.fn(),
  clearState: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  db: () => ({
    googleCredential: { findUnique: m.credential, delete: m.remove },
    syncJob: { updateMany: m.cancel },
    oAuthState: { deleteMany: m.clearState },
    $transaction: m.transaction,
  }),
}));
vi.mock("@/lib/google/client", () => ({
  GSC_SCOPE: "https://www.googleapis.com/auth/webmasters.readonly",
  oauthClient: () => ({ revokeToken: m.revoke }),
}));
import { disconnect } from "@/lib/google/oauth";
import { encrypt } from "@/lib/security/encryption";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString(
    "base64",
  );
  m.credential.mockResolvedValue({
    encryptedRefreshToken: encrypt("refresh-token", "owner"),
  });
  m.revoke.mockResolvedValue({});
  m.transaction.mockResolvedValue([]);
});
it("revokes the grant, removes the credential and fences active jobs", async () => {
  await disconnect("owner");
  expect(m.revoke).toHaveBeenCalledWith("refresh-token");
  expect(m.remove).toHaveBeenCalledWith({ where: { ownerId: "owner" } });
  expect(m.cancel).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ site: { ownerId: "owner" } }),
      data: expect.objectContaining({ status: "FAILED", leaseToken: null }),
    }),
  );
  expect(m.transaction).toHaveBeenCalledOnce();
});
it("disconnects an already revoked Google grant safely", async () => {
  m.revoke.mockRejectedValue({
    response: { status: 400, data: { error: "invalid_token" } },
  });
  await expect(disconnect("owner")).resolves.toBeUndefined();
  expect(m.remove).toHaveBeenCalledOnce();
});
it("preserves the credential when Google revocation cannot be confirmed", async () => {
  m.revoke.mockRejectedValue(new Error("network unavailable"));
  await expect(disconnect("owner")).rejects.toMatchObject({ status: 502 });
  expect(m.remove).not.toHaveBeenCalled();
  expect(m.cancel).not.toHaveBeenCalled();
});
