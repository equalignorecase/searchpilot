import { describe, expect, it } from "vitest";
import {
  aggregate,
  changePercent,
  dimensionKey,
  comparisonRange,
  dateRange,
  pacificDate,
} from "@/features/analytics/math";
import { isOwner } from "@/lib/auth/identity";
import { encrypt, decrypt } from "@/lib/security/encryption";
import { analyze, defaultThresholds } from "@/lib/seo/analyzer";
import { selectRefreshToken } from "@/lib/google/tokens";

describe("metric meaning", () => {
  it("weights CTR and position by impressions", () => {
    expect(
      aggregate([
        { clicks: 10, impressions: 100, position: 2 },
        { clicks: 0, impressions: 900, position: 12 },
      ]),
    ).toEqual({ clicks: 10, impressions: 1000, ctr: 0.01, position: 11 });
    expect(aggregate([])).toEqual({
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    });
  });
  it("does not invent a percentage from zero baseline", () => {
    expect(changePercent(3, 0)).toBeNull();
    expect(changePercent(8, 10)).toBe(-20);
  });
  it("compares equivalent inclusive periods across leap days", () => {
    expect(comparisonRange("2024-03-01", "2024-03-28")).toEqual({
      start: "2024-02-02",
      end: "2024-02-29",
    });
    expect(() => dateRange("2024-02-30", "2024-03-01")).toThrow();
    expect(() => dateRange("2024-03-02", "2024-03-01")).toThrow();
  });
  it("uses Pacific reporting days", () =>
    expect(pacificDate(new Date("2026-01-01T01:00:00Z"))).toBe("2025-12-31"));
  it("hashes exact unicode dimensions without separator collisions", () => {
    expect(dimensionKey(["a|b", "c"])).not.toBe(dimensionKey(["a", "b|c"]));
    expect(dimensionKey(["สว่าน", "https://a.test/A?a=1"])).toHaveLength(64);
  });
});
describe("security", () => {
  it("fails closed unless the managed Neon identity matches the pinned owner", () => {
    const user = {
      id: "neon-user",
      email: "owner@searchpilot.invalid",
      emailVerified: false,
    };
    expect(isOwner(user, {})).toBe(false);
    expect(isOwner(null, { neonUserId: user.id })).toBe(false);
    expect(isOwner(user, { neonUserId: "other" })).toBe(false);
    expect(isOwner(user, { neonUserId: user.id })).toBe(true);
  });
  it("authenticates ciphertext and owner context", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const token = encrypt("refresh-secret", "owner", key);
    expect(decrypt(token, "owner", key)).toBe("refresh-secret");
    expect(() => decrypt(token, "other", key)).toThrow();
    expect(() => decrypt(token.slice(0, -5) + "AAAAA", "owner", key)).toThrow();
    expect(() => encrypt("token", "owner", "bad")).toThrow();
  });
  it("preserves tokens only for the same verified grant identity", () => {
    expect(selectRefreshToken(null, { token: "old", subject: "A" }, "A")).toBe(
      "old",
    );
    expect(selectRefreshToken("new", { token: "old", subject: "A" }, "B")).toBe(
      "new",
    );
    expect(() =>
      selectRefreshToken(undefined, { token: "old", subject: "A" }, "B"),
    ).toThrow();
    expect(() =>
      selectRefreshToken(null, { token: "old", subject: null }, null),
    ).toThrow();
  });
});
const row = (
  query: string,
  page: string,
  clicks: number,
  impressions: number,
  position: number,
) => ({ query, page, clicks, impressions, position });
describe("SEO rules", () => {
  it("detects a qualified decline and potential overlap without asserting harm", () => {
    const current = [
      row("สว่าน", "https://x.test/p", 30, 1000, 12),
      row("สว่าน", "https://x.test/blog", 20, 600, 9),
    ];
    const prior = [
      row("สว่าน", "https://x.test/p", 100, 1000, 8),
      row("สว่าน", "https://x.test/blog", 30, 500, 9),
    ];
    const findings = analyze(
      {
        current,
        previous: prior,
        older: prior.map((r) => ({ ...r, clicks: r.clicks * 2 })),
        peers: [
          ...current,
          ...Array.from({ length: 6 }, (_, i) =>
            row("peer" + i, "https://x.test/" + i, 100, 1000, 12),
          ),
        ],
        targets: [{ targetKeyword: "สว่าน", page: "https://x.test/p" }],
      },
      defaultThresholds,
    );
    expect(findings.some((f) => f.type === "TRAFFIC_DROP")).toBe(true);
    expect(findings.some((f) => f.type === "CONTENT_DECAY")).toBe(true);
    expect(
      findings.find((f) => f.type === "POTENTIAL_CANNIBALIZATION")?.explanation,
    ).toContain("อาจทับซ้อนกัน");
    expect(
      findings.every(
        (f) =>
          f.score >= 0 &&
          f.score <= 100 &&
          f.confidence > 0 &&
          f.evidence &&
          f.nextAction,
      ),
    ).toBe(true);
    expect(new Set(findings.map((f) => f.fingerprint)).size).toBe(
      findings.length,
    );
  });
  it("enforces minimum samples and configurable position thresholds", () => {
    const input = {
      current: [row("small", "p", 1, 5, 8)],
      previous: [],
      older: [],
      peers: [],
      targets: [],
    };
    expect(analyze(input, defaultThresholds)).toEqual([]);
    const next = { ...input, current: [row("win", "p", 30, 1000, 7)] };
    expect(
      analyze(next, defaultThresholds).some((f) => f.type === "QUICK_WIN"),
    ).toBe(true);
    expect(
      analyze(next, { ...defaultThresholds, quickMin: 8 }).some(
        (f) => f.type === "QUICK_WIN",
      ),
    ).toBe(false);
  });
  it("requires a real peer cohort for low CTR", () => {
    const input = {
      current: [row("x", "p", 1, 1000, 5)],
      previous: [],
      older: [],
      peers: [],
      targets: [],
    };
    expect(
      analyze(input, defaultThresholds).some((f) => f.type === "LOW_CTR"),
    ).toBe(false);
  });
});
it("detects qualified declines when current volume is tiny or absent", () => {
  const prior = [
    row("lost", "https://x.test/lost", 100, 2000, 5),
    row("tiny", "https://x.test/tiny", 100, 2000, 5),
  ];
  const findings = analyze({
    current: [row("tiny", "https://x.test/tiny", 1, 50, 30)],
    previous: prior,
    older: [],
    peers: [],
    targets: [],
  });
  expect(
    findings
      .filter((f) => f.type === "TRAFFIC_DROP")
      .map((f) => f.query)
      .sort(),
  ).toEqual(["lost", "tiny"]);
  expect(findings.find((f) => f.query === "lost")?.explanation).toContain(
    "ไม่มีแถวข้อมูลในช่วงปัจจุบัน",
  );
});
it("authorizes a pinned Neon account without requiring its internal email to be verified", () => {
  const user = {
    id: "pinned-owner",
    email: "owner@searchpilot.invalid",
    emailVerified: false,
  };
  expect(isOwner(user, { neonUserId: user.id })).toBe(true);
  expect(isOwner({ ...user, id: "intruder" }, { neonUserId: user.id })).toBe(
    false,
  );
  expect(isOwner(user, {})).toBe(false);
});
