import { beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({
  getSession: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: () => ({ getSession: mocked.getSession }),
}));
vi.mock("@/lib/db/prisma", () => ({
  db: () => ({
    site: { findMany: mocked.findMany, findFirst: mocked.findFirst },
    seoTask: { updateMany: mocked.updateMany },
  }),
}));
vi.mock("@/lib/google/client", () => ({
  googleClient: vi.fn(),
  googleCall: vi.fn(),
}));
vi.mock("@/lib/google/oauth", () => ({ disconnect: vi.fn() }));
vi.mock("@/features/sync/service", () => ({
  enqueue: vi.fn(),
  retryJob: vi.fn(),
}));
import { handleApi } from "@/features/api";
import { errorResponse } from "@/lib/security/http";
const user = {
  id: "owner-id",
  email: "owner@example.com",
  emailVerified: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_USERNAME = "owner";
  process.env.OWNER_NEON_USER_ID = user.id;
  process.env.NEXT_PUBLIC_APP_URL = "https://search.test";
  mocked.getSession.mockResolvedValue({
    data: { user, session: { expiresAt: new Date(Date.now() + 3600000) } },
    error: null,
  });
});
async function call(request: Request, path: string[]) {
  try {
    return await handleApi(request, path);
  } catch (e) {
    return errorResponse(e);
  }
}
describe("server authorization and validation", () => {
  it("rejects missing sessions before reading the database", async () => {
    mocked.getSession.mockResolvedValue({ data: null });
    const r = await call(new Request("https://search.test/api/sites"), [
      "sites",
    ]);
    expect(r.status).toBe(401);
    expect(mocked.findMany).not.toHaveBeenCalled();
  });
  it("rejects non-owner identifiers regardless of email claims", async () => {
    for (const next of [
      { ...user, id: "other", email: "other@example.com" },
      { ...user, id: "other", emailVerified: false },
    ]) {
      mocked.getSession.mockResolvedValue({
        data: {
          user: next,
          session: { expiresAt: new Date(Date.now() + 3600000) },
        },
      });
      expect(
        (await call(new Request("https://search.test/api/sites"), ["sites"]))
          .status,
      ).toBe(403);
    }
    expect(mocked.findMany).not.toHaveBeenCalled();
  });
  it("scopes site listing to the verified Neon user identifier", async () => {
    mocked.findMany.mockResolvedValue([]);
    const r = await call(new Request("https://search.test/api/sites"), [
      "sites",
    ]);
    expect(r.status).toBe(200);
    expect(mocked.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: user.id } }),
    );
  });
  it("rejects cross-origin writes before any DB access", async () => {
    const r = await call(
      new Request("https://search.test/api/tasks", {
        method: "POST",
        headers: {
          origin: "https://attacker.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ siteId: "x", title: "steal" }),
      }),
      ["tasks"],
    );
    expect(r.status).toBe(403);
    expect(mocked.findFirst).not.toHaveBeenCalled();
  });
  it("rejects a site outside the owner scope", async () => {
    mocked.findFirst.mockResolvedValue(null);
    for (const route of ["tasks", "opportunities", "analytics/recent"]) {
      const r = await call(
        new Request("https://search.test/api/" + route + "?siteId=foreign"),
        route.split("/"),
      );
      expect(r.status).toBe(404);
    }
    expect(mocked.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign", ownerId: user.id },
    });
  });
  it("validates task priority and does not write invalid data", async () => {
    mocked.findFirst.mockResolvedValue({ id: "site", ownerId: user.id });
    const r = await call(
      new Request("https://search.test/api/tasks", {
        method: "PATCH",
        headers: {
          origin: "https://search.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ siteId: "site", id: "task", priority: "ROOT" }),
      }),
      ["tasks"],
    );
    expect(r.status).toBe(400);
    expect(mocked.updateMany).not.toHaveBeenCalled();
  });
});
it("rejects expired or incomplete sessions even when a user is returned", async () => {
  for (const session of [null, { expiresAt: new Date(Date.now() - 1000) }]) {
    mocked.getSession.mockResolvedValue({ data: { user, session } });
    expect(
      (await call(new Request("https://search.test/api/sites"), ["sites"]))
        .status,
    ).toBe(401);
  }
  expect(mocked.findMany).not.toHaveBeenCalled();
});
