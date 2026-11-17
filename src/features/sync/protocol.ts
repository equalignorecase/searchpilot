import { addDays, dimensionKey } from "@/features/analytics/math";
export const datasets = [
  "SITE_DAILY",
  "QUERY_DAILY",
  "PAGE_DAILY",
  "QUERY_PAGE_DAILY",
] as const;
export type Dataset = (typeof datasets)[number];
export const dimensions: Record<Dataset, string[]> = {
  SITE_DAILY: ["date"],
  QUERY_DAILY: ["date", "query"],
  PAGE_DAILY: ["date", "page"],
  QUERY_PAGE_DAILY: ["date", "query", "page"],
};
export type Checkpoint = { day: string; dataset: number; offset: number };
export const initialCheckpoint = (day: string): Checkpoint => ({
  day,
  dataset: 0,
  offset: 0,
});
export const retryDelay = (attempt: number) =>
  Math.min(3600000, 30000 * 2 ** (attempt - 1));
export function advance(c: Checkpoint, count: number, end: string) {
  const truncated = c.offset + count >= 50000;
  if (count === 25000 && !truncated)
    return {
      next: { ...c, offset: c.offset + count },
      commit: false,
      truncated: false,
      done: false,
    };
  const next =
    c.dataset < 3
      ? { day: c.day, dataset: c.dataset + 1, offset: 0 }
      : { day: addDays(c.day, 1), dataset: 0, offset: 0 };
  return { next, commit: true, truncated, done: next.day > end };
}
export function normalizeRows(
  dataset: Dataset,
  rows: {
    keys?: string[] | null;
    clicks?: number | null;
    impressions?: number | null;
    ctr?: number | null;
    position?: number | null;
  }[],
) {
  return rows.map((r) => {
    const keys = r.keys || [],
      d = dimensions[dataset];
    if (keys.length !== d.length || !keys.every((k) => typeof k === "string"))
      throw new Error("Invalid Google dimensions");
    const clicks = r.clicks ?? 0,
      impressions = r.impressions ?? 0,
      position = r.position ?? 0;
    if (
      ![clicks, impressions, position].every(
        (n) => Number.isFinite(n) && n >= 0,
      )
    )
      throw new Error("Invalid Google metrics");
    return {
      dimensionKey: dimensionKey(keys.slice(1)),
      query: d.includes("query") ? keys[d.indexOf("query")] : null,
      page: d.includes("page") ? keys[d.indexOf("page")] : null,
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position,
    };
  });
}
