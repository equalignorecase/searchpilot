import { findingText } from "@/lib/locale";
import { aggregate, dimensionKey } from "@/features/analytics/math";
export type AnalysisRow = {
  query: string | null;
  page: string | null;
  clicks: number;
  impressions: number;
  position: number;
};
export const defaultThresholds = {
  minImpressions: 200,
  minClicks: 20,
  quickMin: 4,
  quickMax: 15,
  nearMin: 11,
  nearMax: 20,
  drop: 0.2,
  growth: 0.3,
  weakClicks: 0.1,
  lowCtrRatio: 0.6,
  minPeers: 5,
  decay: 0.15,
  overlapShare: 0.15,
};
export type Thresholds = typeof defaultThresholds;
export type Finding = {
  type: string;
  fingerprint: string;
  query: string | null;
  page: string | null;
  score: number;
  confidence: number;
  evidence: Record<string, number | string | string[] | null>;
  explanation: string;
  nextAction: string;
};
export type AnalysisInput = {
  current: AnalysisRow[];
  previous: AnalysisRow[];
  older: AnalysisRow[];
  peers: AnalysisRow[];
  targets: { targetKeyword: string | null; page: string }[];
};
const groups = (rows: AnalysisRow[]) => {
  const out = new Map<string, AnalysisRow[]>();
  for (const r of rows) {
    const key = JSON.stringify([r.query, r.page]);
    out.set(key, [...(out.get(key) || []), r]);
  }
  return out;
};
export function analyze(
  input: AnalysisInput,
  t: Thresholds = defaultThresholds,
): Finding[] {
  const current = groups(input.current),
    previous = groups(input.previous),
    older = groups(input.older),
    out: Finding[] = [];
  const bandKey = (r: AnalysisRow) =>
    JSON.stringify([
      r.query !== null,
      r.page !== null,
      Math.floor(r.position / 3),
    ]);
  const peerBands = new Map<string, AnalysisRow[]>();
  for (const r of input.peers) {
    if (r.impressions >= t.minImpressions) {
      const key = bandKey(r);
      const band = peerBands.get(key) || [];
      band.push(r);
      peerBands.set(key, band);
    }
  }
  function emit(
    type: string,
    r: AnalysisRow,
    trend: number,
    confidence: number,
    evidence: Finding["evidence"],
    explanation: string,
    nextAction: string,
  ) {
    const volume = Math.min(1, Math.log10(1 + r.impressions) / 5),
      position = Math.max(0, 1 - Math.abs(r.position - 8) / 25),
      impact = Math.min(1, Math.max(0, trend));
    const score = Math.round(
      100 *
        Math.min(
          1,
          (0.35 * volume + 0.2 * position + 0.3 * impact + 0.15 * confidence) *
            confidence,
        ),
    );
    out.push({
      type,
      fingerprint: dimensionKey([type, r.query, r.page, "web:28d:v1"]),
      query: r.query,
      page: r.page,
      score,
      confidence,
      evidence: {
        ...evidence,
        impressions: r.impressions,
        clicks: r.clicks,
        position: r.position,
      },
      explanation: findingText(explanation),
      nextAction: findingText(nextAction),
    });
  }
  for (const key of new Set([...current.keys(), ...previous.keys()])) {
    const rows = current.get(key) || [],
      p = aggregate(previous.get(key) || []),
      o = aggregate(older.get(key) || []);
    const identity = rows[0] || previous.get(key)![0],
      m = aggregate(rows),
      r = { ...identity, ...m };
    const confidence =
      Math.min(
        0.95,
        0.5 + 0.45 * Math.min(1, Math.max(m.impressions, p.impressions) / 2000),
      ) * (rows.length ? 1 : 0.6);
    if (m.impressions >= t.minImpressions) {
      if (m.position >= t.quickMin && m.position <= t.quickMax)
        emit(
          "QUICK_WIN",
          r,
          0.5,
          confidence,
          { range: `${t.quickMin}–${t.quickMax}` },
          "Meaningful visibility close to the leading search results.",
          "Review intent, title relevance, content coverage and internal links.",
        );
      if (m.position >= t.nearMin && m.position <= t.nearMax)
        emit(
          "NEAR_FIRST_PAGE",
          r,
          0.4,
          confidence,
          {},
          "Average position is near the first page; individual rankings vary.",
          "Compare the landing page against the query’s intent.",
        );
      const peers = (peerBands.get(bandKey(r)) || []).filter(
        (x) => !(x.query === r.query && x.page === r.page),
      );
      const median = peers
        .map((x) => x.clicks / x.impressions)
        .sort((a, b) => a - b)[Math.floor(peers.length / 2)];
      if (
        peers.length >= t.minPeers &&
        median > 0 &&
        m.ctr < median * t.lowCtrRatio
      )
        emit(
          "LOW_CTR",
          r,
          1 - m.ctr / median,
          confidence * 0.85,
          { peerCount: peers.length, peerMedianCtr: median, ctr: m.ctr },
          "CTR trails this property’s peers in the same three-position band. Device and brand mix may differ.",
          "Review the search snippet and intent; segment in GSC before editing.",
        );
    }
    if (
      p.impressions >= t.minImpressions &&
      p.clicks >= t.minClicks &&
      m.clicks <= p.clicks * (1 - t.drop)
    )
      emit(
        "TRAFFIC_DROP",
        r,
        1 - m.clicks / p.clicks,
        confidence,
        { previousClicks: p.clicks, decline: 1 - m.clicks / p.clicks },
        rows.length
          ? "Clicks declined against an equivalent previous period."
          : "No row was returned in the current period. Observed clicks declined; Google can omit rows, so verify in GSC.",
        "Check seasonality, indexing, demand and competing pages.",
      );
    if (
      m.impressions >= t.minImpressions &&
      p.impressions >= t.minImpressions &&
      m.impressions >= p.impressions * (1 + t.growth) &&
      m.clicks <= p.clicks * (1 + t.weakClicks)
    )
      emit(
        "IMPRESSION_GROWTH",
        r,
        0.6,
        confidence,
        { previousImpressions: p.impressions, previousClicks: p.clicks },
        "Impressions grew without a comparable improvement in clicks.",
        "Check new queries, intent and snippet alignment.",
      );
    if (
      o.impressions >= t.minImpressions &&
      p.impressions >= t.minImpressions &&
      o.clicks >= t.minClicks &&
      p.clicks >= t.minClicks &&
      p.clicks <= o.clicks * (1 - t.decay) &&
      m.clicks <= p.clicks * (1 - t.decay)
    )
      emit(
        "CONTENT_DECAY",
        r,
        0.7,
        confidence,
        { olderClicks: o.clicks, previousClicks: p.clicks },
        "Clicks fell across three equal periods; this is an observed trend.",
        "Review freshness, seasonality, competitors and indexing before updating.",
      );
  }
  const queries = new Map<string, AnalysisRow[]>();
  for (const rows of current.values()) {
    const r = { ...rows[0], ...aggregate(rows) };
    if (r.query && r.page)
      queries.set(r.query, [...(queries.get(r.query) || []), r]);
  }
  for (const [query, rows] of queries) {
    const total = aggregate(rows);
    if (total.impressions < t.minImpressions) continue;
    const significant = rows.filter(
      (r) =>
        r.impressions >= t.minImpressions &&
        r.impressions / total.impressions >= t.overlapShare,
    );
    if (significant.length < 2) continue;
    const preferred =
      input.targets.find((x) => x.targetKeyword === query)?.page || null;
    emit(
      "POTENTIAL_CANNIBALIZATION",
      { query, page: preferred, ...total },
      0.5,
      0.6,
      { urls: significant.map((r) => r.page!), preferredUrl: preferred },
      "Multiple visible URLs suggest potential overlap. This does not establish harmful cannibalization.",
      "Compare search intent and URL trends; check the preferred landing page before consolidating.",
    );
  }
  return out;
}
