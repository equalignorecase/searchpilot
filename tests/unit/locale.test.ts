import { expect, it } from "vitest";
import { thaiLabel, formatDate, findingText } from "@/lib/locale";
it("translates display labels while preserving unknown values", () => {
  expect(thaiLabel("IN_PROGRESS")).toBe("กำลังดำเนินการ");
  expect(thaiLabel("Product")).toBe("สินค้า");
  expect(thaiLabel("siteOwner")).toBe("เจ้าของเว็บไซต์");
  expect(thaiLabel("customer-created-value")).toBe("customer-created-value");
});
it("keeps reporting dates on their original day with a Gregorian Thai label", () => {
  expect(formatDate("2026-11-16")).toContain("16 พ.ย. 2026");
  expect(formatDate("invalid")).toBe("—");
});
it("renders event timestamps in Bangkok without changing report boundaries", () => {
  expect(formatDate("2026-11-16T20:30:00Z", true)).toContain("17 พ.ย. 2026");
  expect(formatDate("2026-11-16T20:30:00Z", true)).toContain("03:30");
});
it("localizes previously saved opportunity explanations and preserves custom text", () => {
  expect(findingText("Clicks declined against an equivalent previous period.")).toBe("จำนวนคลิกลดลงเมื่อเทียบกับช่วงก่อนหน้าที่มีจำนวนวันเท่ากัน");
  expect(findingText("คำแนะนำที่ผู้ใช้เขียนเอง")).toBe("คำแนะนำที่ผู้ใช้เขียนเอง");
});
