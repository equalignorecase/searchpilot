import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  data: vi.fn(),
  error: vi.fn(),
  busy: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => {
    m.effects.push(effect);
  },
  useState: (initial: unknown) => [
    initial,
    initial === null
      ? m.data
      : initial === ""
        ? m.error
        : initial === false
          ? m.busy
          : vi.fn(),
  ],
}));
import { RecentDashboard } from "@/components/recent-dashboard";
let document: EventTarget & { hidden: boolean };
let cleanup: (() => void) | void;
const fetch = vi.fn();
const response = () => ({
  nextRefreshAt: new Date(Date.now() + 900000).toISOString(),
});
function mount() {
  RecentDashboard({ siteId: "site" });
  cleanup = m.effects[0]();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  m.effects.length = 0;
  document = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", {
    location: { origin: "https://search.test", replace: m.navigate },
  });
  vi.stubGlobal("fetch", fetch);
  fetch.mockReset().mockImplementation(async () => Response.json(response()));
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("polls on the server cache deadline, pauses in background and resumes on visibility", async () => {
  mount();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(899999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  document.hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(1800000);
  expect(fetch).toHaveBeenCalledTimes(2);
  document.hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("does not fetch while initially hidden and cancels an in-flight request on unmount", async () => {
  document.hidden = true;
  fetch.mockImplementation(() => new Promise(() => {}));
  mount();
  expect(fetch).not.toHaveBeenCalled();
  document.hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  const signal = fetch.mock.calls[0][1].signal as AbortSignal;
  cleanup?.();
  expect(signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(1800000);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("retains the last successful response when a later network request fails", async () => {
  fetch
    .mockImplementationOnce(async () => Response.json(response()))
    .mockRejectedValue(new Error("network"));
  mount();
  await vi.advanceTimersByTimeAsync(900000);
  expect(m.data).toHaveBeenCalledTimes(1);
  expect(m.data).not.toHaveBeenCalledWith(null);
  expect(m.error).toHaveBeenLastCalledWith(expect.stringContaining("15 นาที"));
});
it("redirects an expired session to login", async () => {
  fetch.mockResolvedValue(Response.json({}, { status: 401 }));
  mount();
  await vi.advanceTimersByTimeAsync(0);
  expect(m.navigate).toHaveBeenCalledWith("https://search.test/login");
});
