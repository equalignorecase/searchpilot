import { expect, it } from "vitest";
import { todayRange } from "@/lib/locale";
it("uses Search Console's Pacific day rather than the browser's local date", () => {
  expect(todayRange(new Date("2026-11-17T02:00:00Z"))).toEqual({start: "2026-11-16", end: "2026-11-16"});
});
it("switches days at Pacific midnight", () => {
  expect(todayRange(new Date("2026-11-17T08:00:00Z"))).toEqual({start: "2026-11-17", end: "2026-11-17"});
});
it("keeps the Pacific boundary correct during daylight saving time", () => {
  expect(todayRange(new Date("2026-07-01T06:59:59Z"))).toEqual({start: "2026-06-30", end: "2026-06-30"});
  expect(todayRange(new Date("2026-07-01T07:00:00Z"))).toEqual({start: "2026-07-01", end: "2026-07-01"});
});
