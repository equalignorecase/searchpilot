import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OpportunityEvidence } from "@/components/opportunity-evidence";
const render = (evidence: Record<string, unknown>) => renderToStaticMarkup(createElement(OpportunityEvidence, { evidence }));
it("renders evidence as Thai labels and correctly formatted counts and percentages", () => {
  const html = render({previousClicks: 12345, decline: 0.1425, peerMedianCtr: 0.037, position: 7.25});
  const table = html.split("<details")[0];
  expect(table).toContain("คลิกช่วงก่อนหน้า");
  expect(table).toContain("12,345");
  expect(table).toContain("14.25%");
  expect(table).toContain("3.7%");
  expect(table).toContain("7.25");
  expect(html).toContain("ข้อมูลดิบ (JSON)");
  expect(html).toContain("<details");
});
it("keeps zero values, renders missing values clearly and escapes strings", () => {
  const table = render({clicks: 0, preferredUrl: null, urls: ["https://x.test/a", "<script>alert(1)</script>"]}).split("<details")[0];
  expect(table).toContain(">0</td>");
  expect(table).toContain("—");
  expect(table).toContain("https://x.test/a");
  expect(table).not.toContain("<script>");
});
it("explains empty evidence without displaying an empty table", () => {
  const html = render({});
  expect(html).toContain("ยังไม่มีข้อมูลประกอบ");
  expect(html).not.toContain("<table");
});
