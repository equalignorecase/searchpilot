import { expect, test } from "@playwright/test";
import { ownerSession, mockWorkspace, row } from "./fixtures";
test("protected routes redirect without a session; API rejects access", async ({
  page,
  request,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get("/api/sites")).status()).toBe(401);
  expect((await request.get("/api/cron")).status()).toBe(401);
});
test("non-owner identity is denied by the server", async ({
  page,
  context,
}) => {
  await ownerSession(context, "intruder");
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "สำหรับเจ้าของเท่านั้น" }),
  ).toBeVisible();
});
test("safe username/password login restores a signed SDK session on reload", async ({
  page,
  context,
}) => {
  await mockWorkspace(page);
  await page.route("**/api/auth/get-session", (route) => route.fulfill({
    json: { user: { id: "test-owner" }, session: { id: "test-session" } },
  }));
  await page.route("**/api/auth/login", async (route) => {
    await ownerSession(context);
    await route.fulfill({
      json: { ok: true },
    });
  });
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("owner");
  await page
    .getByLabel("รหัสผ่าน", { exact: true })
    .fill("e2e-test-password-only");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "ภาพรวม", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "ภาพรวม", exact: true }),
  ).toBeVisible();
});
test("login without a restored cookie shows an error and allows retry", async ({ page }) => {
  await page.route("**/api/auth/login", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
  await page.goto("/login");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("owner");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("คุกกี้เซสชัน");
  await expect(page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/login/);
});
test("property selection, real-data rendering contract and keyword filters work", async ({
  page,
  context,
}) => {
  await ownerSession(context);
  await mockWorkspace(page);
  await page.goto("/dashboard");
  await expect(page.getByText("จำนวนคลิกทั้งหมด", { exact: true })).toBeVisible();
  await expect(page.getByText(row.label, { exact: true })).toBeVisible();
  await page.getByLabel("เว็บไซต์ใน Search Console").selectOption("site-two");
  await page.reload();
  await expect(page.getByLabel("เว็บไซต์ใน Search Console")).toHaveValue(
    "site-two",
  );
  await page.getByRole("link", { name: "คีย์เวิร์ด", exact: true }).click();
  await page.getByPlaceholder("ค้นหาคีย์เวิร์ด…").fill("missing");
  await page.getByRole("button", { name: "ใช้ตัวกรอง" }).click();
  await expect(
    page.getByRole("heading", { name: "ไม่พบข้อมูลที่ตรงกัน" }),
  ).toBeVisible();
});
test("SEO task creation, status changes and deletion work through the UI", async ({
  page,
  context,
}) => {
  await ownerSession(context);
  await mockWorkspace(page);
  let tasks: Record<string, unknown>[] = [];
  await page.route("**/api/tasks**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      tasks.push({ ...body, id: "task-one", completedAt: null });
      return route.fulfill({ status: 201, json: tasks[0] });
    }
    if (request.method() === "PATCH") {
      const body = request.postDataJSON();
      tasks = tasks.map((t) => (t.id === body.id ? { ...t, ...body } : t));
      return route.fulfill({ json: { ok: true } });
    }
    if (request.method() === "DELETE") {
      tasks = [];
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: tasks });
  });
  await page.goto("/tasks");
  await page.getByRole("button", { name: "สร้างงานใหม่" }).click();
  await page.getByLabel("ชื่องาน", { exact: true }).fill("Improve drill title");
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(
    page.getByRole("heading", { name: "Improve drill title" }),
  ).toBeVisible();
  await page
    .getByLabel("สถานะของ Improve drill title", { exact: true })
    .selectOption("DONE");
  await expect(
    page.getByLabel("สถานะของ Improve drill title", { exact: true }),
  ).toHaveValue("DONE");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "ลบ Improve drill title" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Improve drill title" }),
  ).not.toBeVisible();
});
test("mobile navigation and both color themes remain usable", async ({
  page,
  context,
}) => {
  await ownerSession(context);
  await mockWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "เปิดเมนู" }).click();
  await page.getByRole("link", { name: "หน้าเว็บ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ประสิทธิภาพหน้าเว็บ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "สลับธีมสี" }).click();
  expect(await page.locator("html").getAttribute("class")).toContain("dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("empty property state never fabricates analytics", async ({
  page,
  context,
}) => {
  await ownerSession(context);
  await mockWorkspace(page);
  await page.route("**/api/sites", (route) => route.fulfill({ json: [] }));
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "เชื่อมต่อข้อมูลการค้นหา" }),
  ).toBeVisible();
  await expect(
    page.getByText("จำนวนคลิกทั้งหมด", { exact: true }),
  ).not.toBeVisible();
});
test("today preset requests a single Pacific reporting day and disables finalized-only sync", async ({ page, context }) => {
  await ownerSession(context);
  await mockWorkspace(page);
  await page.goto("/dashboard");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const request = page.waitForRequest((r) => {
    const url = new URL(r.url());
    return url.pathname === "/api/analytics" && url.searchParams.get("start") === today && url.searchParams.get("end") === today;
  });
  await page.getByLabel("ช่วงวันที่", { exact: true }).selectOption("today");
  await request;
  await expect(page.getByText("วันนี้อ้างอิงเวลาแปซิฟิกของ Search Console", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "ซิงก์ข้อมูล", exact: true })).toBeDisabled();
  await page.getByLabel("ช่วงวันที่", { exact: true }).selectOption("7");
  await expect(page.getByRole("button", { name: "ซิงก์ข้อมูล", exact: true })).toBeEnabled();
});
test("opportunities paginate and reset the page when a rule filter changes", async ({ page, context }) => {
  await ownerSession(context);
  await mockWorkspace(page);
  const items = Array.from({length: 21}, (_, index) => ({
    id: `opportunity-${index}`, type: index === 20 ? "LOW_CTR" : "QUICK_WIN",
    query: `โอกาส ${index + 1}`, page: null, score: 90 - index,
    confidence: 0.8, explanation: "ข้อมูลทดสอบ", nextAction: "ตรวจหน้าเว็บ",
    evidence: {}, status: "OPEN", detectedAt: "2026-11-17T00:00:00Z",
  }));
  await page.route("**/api/opportunities?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    const filtered = items.filter(item => params.get("type") === "ALL" || item.type === params.get("type"));
    const current = Math.min(Number(params.get("page") || 1), Math.max(1, Math.ceil(filtered.length / 10)));
    return route.fulfill({json: {rows: filtered.slice((current - 1) * 10, current * 10), total: filtered.length, page: current, pageSize: 10}});
  });
  await page.goto("/opportunities");
  const nav = page.getByRole("navigation", {name: "การแบ่งหน้าโอกาสปรับปรุง"});
  await expect(page.getByRole("heading", {name: "โอกาส 1", exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {name: "โอกาส 11", exact: true})).toHaveCount(0);
  await expect(nav.getByRole("button", {name: "ก่อนหน้า"})).toBeDisabled();
  await nav.getByRole("button", {name: "ถัดไป"}).click();
  await expect(page.getByRole("heading", {name: "โอกาส 11", exact: true})).toBeVisible();
  await nav.getByRole("button", {name: "ถัดไป"}).click();
  await expect(page.getByRole("heading", {name: "โอกาส 21", exact: true})).toBeVisible();
  await expect(nav.getByRole("button", {name: "ถัดไป"})).toBeDisabled();
  await page.getByLabel("เกณฑ์วิเคราะห์", {exact: true}).selectOption("LOW_CTR");
  await expect(nav).toContainText("หน้า 1 จาก 1");
  await expect(nav).toContainText("จาก 1 รายการ");
  await expect(nav.getByRole("button", {name: "ก่อนหน้า"})).toBeDisabled();
});
test("opportunity details show readable evidence and desktop/mobile actions keep working", async ({ page, context }) => {
  await ownerSession(context);
  await mockWorkspace(page);
  const opportunity = {
    id: "readable-opportunity", type: "TRAFFIC_DROP", query: "คีย์เวิร์ดตัวอย่าง", page: "https://example.test/product",
    score: 80, confidence: 0.85, explanation: "จำนวนคลิกลดลง", nextAction: "ตรวจเนื้อหาหน้าเว็บ",
    evidence: {clicks: 12, impressions: 1200, decline: 0.25, preferredUrl: null},
    status: "OPEN", detectedAt: "2026-11-17T00:00:00Z",
  };
  let dismissed = false;
  let task: Record<string, unknown> | undefined;
  await page.route("**/api/opportunities?**", route => {
    if (route.request().method() === "PATCH") return route.continue();
    return route.fulfill({json: {rows: dismissed ? [] : [opportunity], total: dismissed ? 0 : 1, page: 1, pageSize: 10}});
  });
  await page.route("**/api/opportunities", route => {
    expect(route.request().postDataJSON()).toMatchObject({id: opportunity.id, status: "DISMISSED"});
    dismissed = true;
    return route.fulfill({json: {ok: true}});
  });
  await page.route("**/api/tasks", route => {
    task = route.request().postDataJSON();
    return route.fulfill({status: 201, json: {id: "new-task"}});
  });
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto("/opportunities");
  const table = page.getByRole("region", {name: "ตารางโอกาสปรับปรุง"});
  await expect(table).toBeVisible();
  await page.getByRole("button", {name: "ดูรายละเอียด คีย์เวิร์ดตัวอย่าง", exact: true}).click();
  const dialog = page.getByRole("dialog", {name: opportunity.query});
  await expect(dialog.getByRole("cell", {name: "1,200", exact: true})).toBeVisible();
  await expect(dialog.getByRole("cell", {name: "25%", exact: true})).toBeVisible();
  await expect(dialog.locator("details")).not.toHaveAttribute("open", "");
  await dialog.getByText("ข้อมูลดิบ (JSON)", {exact: true}).click();
  await expect(dialog.locator("pre")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.setViewportSize({width: 390, height: 844});
  await expect(table).not.toBeVisible();
  await expect(page.getByRole("heading", {name: opportunity.query, exact: true})).toBeVisible();
  await page.getByRole("button", {name: "สร้างงาน คีย์เวิร์ดตัวอย่าง", exact: true}).click();
  await expect(page.getByText("สร้างงานในศูนย์งาน SEO แล้ว", {exact: true})).toBeVisible();
  expect(task).toMatchObject({opportunityId: opportunity.id, priority: "HIGH"});
  await page.getByRole("button", {name: "ละเว้น คีย์เวิร์ดตัวอย่าง", exact: true}).click();
  await expect(page.getByRole("heading", {name: "ไม่พบโอกาสปรับปรุงตามตัวกรองนี้"})).toBeVisible();
});

test("analytics headers and identity column stay pinned while the table scrolls", async ({ page, context }) => {
  await ownerSession(context);
  await mockWorkspace(page);
  await page.route("**/api/keywords?**", route => route.fulfill({json: {
    rows: Array.from({length: 25}, (_, i) => ({...row, label: `คีย์เวิร์ดตัวอย่างรายการที่ ${i + 1}`})),
    total: 25, pageSize: 25,
  }}));
  await page.setViewportSize({width: 1100, height: 800});
  await page.goto("/keywords");
  const region = page.getByRole("region", {name: "ตารางคีย์เวิร์ด"});
  await expect(region.getByRole("cell", {name: "คีย์เวิร์ดตัวอย่างรายการที่ 1", exact: true})).toBeVisible();
  const header = region.locator("thead th").first();
  const identity = region.locator("tbody tr").first().locator("td").first();
  const beforeHeader = await header.boundingBox();
  const beforeIdentity = await identity.boundingBox();
  const scroll = await region.evaluate(el => {
    el.scrollTop = 200; el.scrollLeft = 100;
    return {top: el.scrollTop, left: el.scrollLeft};
  });
  expect(scroll.top).toBeGreaterThan(0);
  expect(scroll.left).toBeGreaterThan(0);
  expect((await header.boundingBox())!.y).toBeCloseTo(beforeHeader!.y, 0);
  expect((await identity.boundingBox())!.x).toBeCloseTo(beforeIdentity!.x, 0);
});
