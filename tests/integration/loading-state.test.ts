import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ResourceState } from "@/components/dashboard";
it("announces loading and hides decorative placeholders from assistive technology", () => {
  const html = renderToStaticMarkup(createElement(ResourceState, {loading: true, error: ""}));
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("กำลังโหลดข้อมูล");
});
it("shows errors instead of an endless skeleton", () => {
  const html = renderToStaticMarkup(createElement(ResourceState, {loading: true, error: "โหลดข้อมูลไม่สำเร็จ"}));
  expect(html).toContain('role="alert"');
  expect(html).toContain("โหลดข้อมูลไม่สำเร็จ");
  expect(html).not.toContain('role="status"');
});
it("removes the loading UI once the request settles", () => {
  expect(renderToStaticMarkup(createElement(ResourceState, {loading: false, error: ""}))).toBe("");
});
it.each(["dashboard", "table", "list", "chart"] as const)("renders the %s layout as a single accessible loading status", (variant) => {
  const html = renderToStaticMarkup(createElement(ResourceState, {loading: true, error: "", variant}));
  expect(html.match(/role="status"/g)).toHaveLength(1);
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain('role="alert"');
});
