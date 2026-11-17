import { addDays } from "./math";
export function coversRange(
  start: string,
  end: string,
  ranges: { start: string; end: string }[],
) {
  let next = start;
  for (const range of [...ranges].sort((a, b) =>
    a.start.localeCompare(b.start),
  )) {
    if (range.end < next) continue;
    if (range.start > next) return false;
    next = addDays(range.end, 1);
    if (next > end) return true;
  }
  return false;
}
