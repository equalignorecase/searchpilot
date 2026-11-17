import { pacificDate } from "@/lib/locale";
export { pacificDate } from "@/lib/locale";
import { createHash } from "node:crypto";
export type Metric = { clicks: number; impressions: number; position: number };
export function aggregate(rows: Metric[]) {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0),
    impressions = rows.reduce((s, r) => s + r.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions
      ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions
      : 0,
  };
}
export const changePercent = (now: number, before: number): number | null =>
  before ? Math.round(((now - before) / before) * 10000) / 100 : null;
export const dimensionKey = (keys: (string | null)[]) =>
  createHash("sha256").update(JSON.stringify(keys)).digest("hex");
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) =>
  iso(new Date(new Date(day + "T00:00:00Z").getTime() + n * 86400000));
export function dateRange(start: string, end: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    iso(new Date(start)) !== start ||
    iso(new Date(end)) !== end ||
    start > end
  )
    throw new Error("ช่วงวันที่ไม่ถูกต้อง");
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (days > 500) throw new Error("เลือกช่วงเวลาได้ไม่เกิน 500 วัน");
  return { start, end, days };
}
export function comparisonRange(start: string, end: string) {
  const { days } = dateRange(start, end);
  return { start: addDays(start, -days), end: addDays(start, -1) };
}
export function defaultRange(days = 28) {
  const end = addDays(pacificDate(), -3);
  return { start: addDays(end, 1 - days), end };
}
