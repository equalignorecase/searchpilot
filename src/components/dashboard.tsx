"use client";
import Link from "next/link";
import { RecentDashboard } from "./recent-dashboard";
import { formatDate, todayRange } from "@/lib/locale";
import { useState } from "react";
import {
  MousePointerClick,
  Eye,
  Percent,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ChartNoAxesCombined,
  Link2,
  Clock3,
} from "lucide-react";
import { Card } from "./ui/card";
import { LoadingSkeleton, type LoadingVariant } from "./ui/loading-skeleton";
import { Button } from "./ui/button";
import { useWorkspace, useResource, api } from "./layout/workspace";
import { PerformanceChart, type Daily } from "./charts/performance";
import type { TableRow } from "@/features/analytics/service";
export const number = (n: number, digits = 0) =>
  n.toLocaleString("th-TH", { maximumFractionDigits: digits });
export function EmptyProperty() {
  return (
    <Card>
      <div className="empty">
        <Link2 size={32} />
        <h2>เชื่อมต่อข้อมูลการค้นหา</h2>
        <p className="text-muted-foreground max-w-md leading-6">
          อนุญาตการเข้าถึง Search Console แล้วค้นหาเว็บไซต์ของคุณเพื่อเริ่มดูผลการค้นหาจากข้อมูลจริง
        </p>
        <Button asChild className="mt-3">
          <Link href="/settings">
            เชื่อมต่อ Search Console <ArrowUpRight size={15} />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
export function ResourceState({
  loading,
  error,
  variant = "list",
}: {
  loading: boolean;
  error: string;
  variant?: LoadingVariant;
}) {
  if (error)
    return (
      <div role="alert" className="error">
        {error}
      </div>
    );
  if (loading)
    return <LoadingSkeleton variant={variant} />;
  return null;
}
export function Dashboard() {
  const w = useWorkspace();
  if (w.start === w.end && w.end === todayRange().end) {
    if (w.loading) return <LoadingSkeleton variant="dashboard" />;
    if (!w.siteId) return <EmptyProperty />;
    return <RecentDashboard key={w.siteId} siteId={w.siteId} />;
  }
  return <HistoricalDashboard />;
}
function HistoricalDashboard() {
  const w = useWorkspace(),
    [metric, setMetric] = useState<
      "clicks" | "impressions" | "ctr" | "position"
    >("clicks"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const { data, loading, error } = useResource<{
    metrics: {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    };
    previous: { impressions: number };
    changes: {
      clicks: number | null;
      impressions: number | null;
      ctr: number | null;
      position: number | null;
    };
    daily: Daily[];
    lastSyncAt: string | null;
    hasData: boolean;
    fullRangeSynced: boolean;
    truncated: boolean;
  }>(w.siteId ? "analytics?" + w.query : null);
  const queries = useResource<{ rows: TableRow[] }>(
      w.siteId ? "keywords?" + w.query : null,
    ),
    pages = useResource<{ rows: TableRow[] }>(
      w.siteId ? "pages?" + w.query : null,
    );
  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      await api("sync", { siteId: w.siteId, start: w.start, end: w.end });
      setMessage(
        "เพิ่มงานซิงก์ในคิวแล้ว ระบบจะประมวลผลเบื้องหลัง",
      );
      w.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const kpis = [
    {
      key: "clicks" as const,
      label: "จำนวนคลิกทั้งหมด",
      icon: MousePointerClick,
      format: (n: number) => number(n),
    },
    {
      key: "impressions" as const,
      label: "จำนวนการแสดงผลทั้งหมด",
      icon: Eye,
      format: (n: number) => number(n),
    },
    {
      key: "ctr" as const,
      label: "CTR เฉลี่ย",
      icon: Percent,
      format: (n: number) => number(n * 100, 2) + "%",
    },
    {
      key: "position" as const,
      label: "อันดับเฉลี่ย",
      icon: Hash,
      format: (n: number) => number(n, 1),
    },
  ];
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="text-xs text-muted-foreground mb-2">
            ผลการค้นหาของเว็บไซต์คุณ
          </div>
          <h1>ภาพรวม</h1>
          <p>ดูผลการค้นหาแบบออร์แกนิกและวางแผนสิ่งที่ควรปรับปรุงต่อไป</p>
        </div>
        <Button variant="outline" disabled={!w.siteId || busy} onClick={sync}>
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          {busy ? "กำลังเพิ่มในคิว…" : "ซิงก์ข้อมูล"}
        </Button>
      </div>
      {message && (
        <p role="status" className="notice mb-5">
          {message}
        </p>
      )}
      {w.loading ? (
        <ResourceState loading error="" variant="dashboard" />
      ) : !w.siteId ? (
        <EmptyProperty />
      ) : (
        <>
          <ResourceState loading={loading} error={error} variant="dashboard" />
          {data && !loading && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-5">
                <span
                  className={"pill " + (data.lastSyncAt ? "badge-green" : "")}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {data.lastSyncAt ? "ข้อมูลที่ซิงก์แล้ว" : "รอซิงก์ครั้งแรก"}
                </span>
                <span className="flex gap-1.5 items-center">
                  <Clock3 size={13} />
                  {data.lastSyncAt
                    ? "ซิงก์สำเร็จล่าสุด " +
                      formatDate(data.lastSyncAt, true)
                    : "ยังไม่มีการซิงก์ที่สำเร็จ"}
                </span>
                <span className="ml-auto">
                  {formatDate(w.start)} — {formatDate(w.end)}
                </span>
              </div>
              <div className="kpi-grid">
                {kpis.map((k) => {
                  const delta = data.changes[k.key],
                    isPosition = k.key === "position";
                  return (
                    <Card key={k.key} className="kpi-card p-5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{k.label}</span>
                        <k.icon size={16} />
                      </div>
                      <div className="text-[30px] font-semibold tabular mt-3">
                        {data.hasData ? k.format(data.metrics[k.key]) : "—"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-1.5 gap-y-1 items-center text-xs text-muted-foreground">
                        {delta !== null && data.hasData ? (
                          <>
                            <span
                              className={
                                (isPosition ? delta < 0 : delta > 0)
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-muted-foreground"
                              }
                            >
                              {delta > 0 ? (
                                <ArrowUpRight size={12} className="inline" />
                              ) : (
                                <ArrowDownRight size={12} className="inline" />
                              )}{" "}
                              {number(
                                Math.abs(delta) * (k.key === "ctr" ? 100 : 1),
                                2,
                              )}
                              {k.key === "ctr" ? " จุดเปอร์เซ็นต์" : isPosition ? "" : "%"}
                            </span>
                            <span>เทียบกับช่วงก่อนหน้า</span>
                          </>
                        ) : (
                          "ไม่มีข้อมูลสำหรับเปรียบเทียบ"
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
              <Card className="mt-6">
                <div className="panel-title flex-wrap">
                  <div>
                    <h2>ประสิทธิภาพการค้นหา</h2>
                    <p className="text-xs text-muted-foreground mt-2">
                      ข้อมูลการค้นหาเว็บที่สรุปแล้ว · ยอดรวมเว็บไซต์คำนวณแยกจากชุดข้อมูลอื่น
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {kpis.map((k) => (
                      <Button
                        key={k.key}
                        variant={metric === k.key ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setMetric(k.key)}
                      >
                        {k.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {data.hasData ? (
                  <div className="p-3 pt-5">
                    <PerformanceChart data={data.daily} metric={metric} />
                  </div>
                ) : (
                  <div className="empty min-h-72">
                    <ChartNoAxesCombined size={36} />
                    <h2>เริ่มดูประวัติการค้นหาของคุณที่นี่</h2>
                    <p className="text-sm text-muted-foreground">
                      เพิ่มงานซิงก์สำหรับช่วงเวลานี้ ผลการค้นหาจริงจะแสดงเมื่อซิงก์เสร็จ
                    </p>
                    <Button
                      onClick={sync}
                      disabled={busy}
                      variant="outline"
                      size="sm"
                      className="mt-3"
                    >
                      ซิงก์ช่วงเวลานี้
                    </Button>
                  </div>
                )}
              </Card>
              {!data.fullRangeSynced && (
                <p className="notice mt-4">
                  ยังไม่มีงานซิงก์ที่สำเร็จครอบคลุมช่วงเวลานี้ทั้งหมด วันที่ขาดข้อมูลจะไม่ถูกนับเป็นวันที่ไม่มีผู้เข้าชมโดยอัตโนมัติ
                </p>
              )}
              {data.truncated && (
                <p className="notice mt-4">
                  ชุดข้อมูลถึงขีดจำกัดจำนวนแถวต่อวันของ Google ข้อมูลคำค้นหาจึงอาจไม่ครบ
                </p>
              )}
              <div className="two-col mt-6">
                {[
                  {
                    label: "คำค้นหายอดนิยม",
                    href: "/keywords",
                    resource: queries,
                  },
                  { label: "หน้าเว็บยอดนิยม", href: "/pages", resource: pages },
                ].map((section) => (
                  <Card key={section.href}>
                    <div className="panel-title">
                      <h2>{section.label}</h2>
                      <Link href={section.href} className="link text-xs">
                        ดูทั้งหมด <ArrowUpRight size={13} className="inline" />
                      </Link>
                    </div>
                    <ResourceState
                      variant="table"
                      loading={section.resource.loading}
                      error={section.resource.error}
                    />
                    {section.resource.data?.rows.length ? (
                      <div className="overflow-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th>
                                {section.label === "คำค้นหายอดนิยม"
                                  ? "คำค้นหา"
                                  : "หน้าเว็บ"}
                              </th>
                              <th>คลิก</th>
                              <th>การแสดงผล</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.resource.data.rows
                              .slice(0, 5)
                              .map((row) => (
                                <tr key={row.label}>
                                  <td
                                    className="max-w-40 truncate"
                                    title={row.label}
                                  >
                                    {row.label}
                                  </td>
                                  <td>{number(row.clicks)}</td>
                                  <td>{number(row.impressions)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      !section.resource.loading && !section.resource.error && (
                        <div className="empty text-muted-foreground text-xs">
                          ยังไม่มีข้อมูลที่ซิงก์สำหรับช่วงเวลานี้
                        </div>
                      )
                    )}
                  </Card>
                ))}
              </div>
              <Card className="mt-6 p-6 flex items-start gap-5 flex-wrap">
                <div className="flex-1 min-w-52">
                  <h2>เปลี่ยนข้อมูลการค้นหาเป็นแผนลงมือทำ</h2>
                  <p className="text-xs text-muted-foreground leading-6 mt-2">
                    ค้นหาโอกาสที่ปรับปรุงได้เร็ว แนวโน้มยอดเข้าชมลดลง และ URL ที่อาจทับซ้อนกัน ด้วยเกณฑ์ที่ตรวจสอบได้จากข้อมูลของคุณ
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/opportunities">
                    ดูโอกาสปรับปรุง <ArrowUpRight size={14} />
                  </Link>
                </Button>
              </Card>
              <p className="text-[11px] text-muted-foreground leading-5 mt-5">
                Search Console ส่งคืนแถวยอดนิยมและอาจไม่แสดงคำค้นหาที่ไม่ระบุตัวตน ยอดรวมคำค้นหาและหน้าเว็บอาจต่างจากยอดรวมเว็บไซต์ ข้อมูลล่าสุดจะแสดงเมื่อสรุปแล้ว อันดับเฉลี่ยถ่วงน้ำหนักด้วยจำนวนการแสดงผล
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
