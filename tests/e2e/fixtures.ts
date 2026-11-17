import { createHmac } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
export const TEST_SECRET = "searchpilot-e2e-only-cookie-secret-0123456789";
export const BASE_URL = "http://127.0.0.1:3100";
export async function ownerSession(
  context: BrowserContext,
  ownerId = "test-owner",
) {
  const now = new Date().toISOString(),
    expires = new Date(Date.now() + 3600000).toISOString();
  const payload = {
    session: {
      id: "test-session",
      token: "test-opaque",
      userId: ownerId,
      expiresAt: expires,
      createdAt: now,
      updatedAt: now,
    },
    user: {
      id: ownerId,
      email: "owner@searchpilot.invalid",
      emailVerified: false,
      name: "Test Owner",
      createdAt: now,
      updatedAt: now,
    },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: ownerId,
  };
  const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url"),
    body = Buffer.from(JSON.stringify(payload)).toString("base64url"),
    signature = createHmac("sha256", TEST_SECRET)
      .update(header + "." + body)
      .digest("base64url");
  await context.addCookies([
    {
      name: "__Secure-neon-auth.session_token",
      value: "test-opaque",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "__Secure-neon-auth.local.session_data",
      value: header + "." + body + "." + signature,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}
export const site = {
  id: "site-one",
  siteUrl: "sc-domain:example.test",
  displayName: "example.test",
  permission: "siteOwner",
  isDefault: true,
  propertyType: "DOMAIN",
  lastSyncAt: "2026-10-01T12:00:00Z",
};
export const row = {
  label: "cordless drill",
  clicks: 120,
  impressions: 5000,
  ctr: 0.024,
  position: 8.2,
  clickChange: 20,
  impressionChange: 10,
  positionChange: -1.3,
};
export async function mockWorkspace(page: Page) {
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url()),
      path = u.pathname;
    if (path === "/api/sites")
      return route.fulfill({
        json: [
          site,
          {
            ...site,
            id: "site-two",
            siteUrl: "https://other.test/",
            displayName: "other.test",
            isDefault: false,
            propertyType: "URL_PREFIX",
          },
        ],
      });
    if (path === "/api/analytics/recent") {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const date = day + "T12:00:00Z";
      return route.fulfill({ json: { day, hours: [{ date, clicks: 5, impressions: 100, ctr: 0.05, position: 4 }], metrics: { clicks: 5, impressions: 100, ctr: 0.05, position: 4 }, available: true, hasData: true, fetchedAt: new Date().toISOString(), latestHour: date, firstIncompleteHour: date, stale: false, refreshing: false, warning: null, nextRefreshAt: new Date(Date.now() + 900000).toISOString() } });
    }
    if (path === "/api/analytics")
      return route.fulfill({
        json: {
          metrics: {
            clicks: 120,
            impressions: 5000,
            ctr: 0.024,
            position: 8.2,
          },
          previous: { impressions: 4500 },
          changes: { clicks: 20, impressions: 10, ctr: 0.002, position: -1.3 },
          daily: [
            {
              date: "2026-10-01",
              clicks: 50,
              impressions: 2000,
              ctr: 0.025,
              position: 8,
            },
            {
              date: "2026-10-02",
              clicks: 70,
              impressions: 3000,
              ctr: 0.0233,
              position: 8.3,
            },
          ],
          lastSyncAt: site.lastSyncAt,
          hasData: true,
          fullRangeSynced: true,
          comparisonComplete: true,
          truncated: false,
        },
      });
    if (path === "/api/keywords" || path === "/api/pages")
      return route.fulfill({
        json: {
          rows:
            u.searchParams.get("search") === "missing"
              ? []
              : [
                  {
                    ...row,
                    label:
                      path === "/api/pages"
                        ? "https://example.test/product/drill"
                        : row.label,
                  },
                ],
          total: u.searchParams.get("search") === "missing" ? 0 : 1,
          pageSize: 25,
        },
      });
    if (path === "/api/history")
      return route.fulfill({
        json: { daily: [], related: [], targets: [], changes: [] },
      });
    if (path === "/api/opportunities")
      return route.fulfill({ json: { rows: [], total: 0, page: 1, pageSize: 10 } });
    if (
      path === "/api/inspections" ||
      path === "/api/sync"
    )
      return route.fulfill({ json: [] });
    return route.continue();
  });
}
