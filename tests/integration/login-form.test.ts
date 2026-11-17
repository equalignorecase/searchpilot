import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ pending: vi.fn(), error: vi.fn(), navigate: vi.fn(), router: {replace: vi.fn(), refresh: vi.fn()} }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => initial === false ? [false, m.pending] : ["", m.error],
}));
vi.mock("next/navigation", () => ({ useRouter: () => m.router }));
import { LoginForm } from "@/components/login-form";
async function submit() {
  const form = LoginForm({});
  await form.props.onSubmit({preventDefault() {}, currentTarget: {}});
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", {location: {replace: m.navigate}});
  vi.stubGlobal("FormData", class { get(key: string) { return key === "username" ? "owner" : "fixture-password"; } });
});
afterEach(() => vi.unstubAllGlobals());
it("checks the browser session before a full navigation and resets pending", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ok: true}))
    .mockResolvedValueOnce(Response.json({user: {id: "owner"}, session: {id: "session"}}));
  vi.stubGlobal("fetch", fetch);
  await submit();
  expect(fetch.mock.calls[1]?.[0]).toBe("/api/auth/get-session");
  expect(m.navigate).toHaveBeenCalledWith("/dashboard");
  expect(m.pending).toHaveBeenLastCalledWith(false);
});
it("shows a missing-session error instead of leaving the login button stuck", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(Response.json({ok: true}))
    .mockResolvedValueOnce(Response.json(null)));
  await submit();
  expect(m.navigate).not.toHaveBeenCalled();
  expect(m.error).toHaveBeenLastCalledWith(expect.stringContaining("คุกกี้เซสชัน"));
  expect(m.pending).toHaveBeenLastCalledWith(false);
});
it("bounds the login request and shows a readable timeout", async () => {
  const fetch = vi.fn().mockRejectedValue(new DOMException("fixture", "TimeoutError"));
  vi.stubGlobal("fetch", fetch);
  await submit();
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  expect(m.error).toHaveBeenLastCalledWith("เข้าสู่ระบบใช้เวลานานเกินไป กรุณาลองอีกครั้ง");
  expect(m.pending).toHaveBeenLastCalledWith(false);
});
it("preserves server login errors and allows retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"}, {status: 401})));
  await submit();
  expect(m.error).toHaveBeenLastCalledWith("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  expect(m.pending).toHaveBeenLastCalledWith(false);
  expect(m.navigate).not.toHaveBeenCalled();
});
