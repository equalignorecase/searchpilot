import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({
  auth: () => ({ handler: () => ({ GET: m.get, POST: m.post }) }),
}));
import { GET, POST } from "@/app/api/auth/[...path]/route";
beforeEach(() => {
  vi.clearAllMocks();
  m.get.mockResolvedValue(Response.json(null));
  m.post.mockResolvedValue(Response.json({ ok: true }));
});
const context = (path: string) => ({
  params: Promise.resolve({ path: path.split("/") }),
});
it("blocks public sign-up, social login and direct email login before proxying to Neon", async () => {
  for (const path of [
    "sign-up/email",
    "sign-in/email",
    "sign-in/social",
    "admin/create-user",
  ])
    expect(
      (
        await POST(
          new Request("https://search.test/api/auth/" + path, {
            method: "POST",
          }),
          context(path),
        )
      ).status,
    ).toBe(404);
  expect(m.post).not.toHaveBeenCalled();
});
it("keeps managed session restoration and sign-out available", async () => {
  expect(
    (
      await GET(
        new Request("https://search.test/api/auth/get-session"),
        context("get-session"),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await POST(
        new Request("https://search.test/api/auth/sign-out", {
          method: "POST",
        }),
        context("sign-out"),
      )
    ).status,
  ).toBe(200);
  expect(m.get).toHaveBeenCalledOnce();
  expect(m.post).toHaveBeenCalledOnce();
});
