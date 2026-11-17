import { expect, it } from "vitest";
import { hourlyChartData } from "@/components/charts/performance";
it("leaves missing hours as null instead of fabricating zero traffic", () => {
  const value = { clicks: 2, impressions: 100, ctr: 0.02, position: 4 };
  const result = hourlyChartData([
    { date: "2026-11-17T08:00:00Z", ...value },
    { date: "2026-11-17T10:00:00Z", ...value },
  ]);
  expect(result).toHaveLength(3);
  expect(result[1]).toEqual({
    date: "2026-11-17T09:00:00.000Z",
    clicks: null,
    impressions: null,
    ctr: null,
    position: null,
  });
});
