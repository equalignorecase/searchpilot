"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { RecentSearch } from "@/features/analytics/recent";
import { formatDate } from "@/lib/locale";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { LoadingSkeleton } from "./ui/loading-skeleton";
import { PerformanceChart } from "./charts/performance";

const labels = {
  clicks: "จำนวนคลิกทั้งหมด",
  impressions: "จำนวนการแสดงผลทั้งหมด",
  ctr: "CTR เฉลี่ย",
  position: "อันดับเฉลี่ย",
};
const pacificHour = (value: string) =>
  new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function RecentDashboard({ siteId }: { siteId: string }) {
  const [data, setData] = useState<RecentSearch | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [metric, setMetric] = useState<keyof typeof labels>("clicks");
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function load() {
      if (disposed || document.hidden) return;
      const current = new AbortController();
      controller = current;
      const signal = current.signal;
      const timeout = setTimeout(() => current.abort(), 75000);
      setBusy(true);
      let delay = 15 * 60 * 1000;
      try {
        const response = await fetch(
          "/api/analytics/recent?siteId=" + encodeURIComponent(siteId),
          { cache: "no-store", signal },
        );
        if (response.status === 401) {
          window.location.replace(
            new URL("/login", window.location.origin).href,
          );
          return;
        }
        if (!response.ok)
          throw new Error(
            "โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและสิทธิ์เว็บไซต์",
          );
        const result: RecentSearch = await response.json();
        if (signal.aborted || disposed) return;
        setData(result);
        setError("");
        delay = Math.max(
          5000,
          new Date(result.nextRefreshAt).getTime() - Date.now(),
        );
      } catch {
        if (!disposed && controller === current && !document.hidden)
          setError("โหลดข้อมูลล่าสุดไม่สำเร็จ ระบบจะลองใหม่ภายใน 15 นาที");
      } finally {
        clearTimeout(timeout);
        if (!disposed && controller === current) {
          controller = undefined;
          setBusy(false);
          if (!document.hidden) timer = setTimeout(load, delay);
        }
      }
    }
    function visibility() {
      clearTimeout(timer);
      controller?.abort();
      controller = undefined;
      if (document.hidden) setBusy(false);
      else void load();
    }
    document.addEventListener("visibilitychange", visibility);
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [siteId, version]);
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="text-xs text-muted-foreground mb-2">
            ผลการค้นหาของเว็บไซต์คุณ
          </div>
          <h1>ข้อมูลล่าสุดวันนี้</h1>
          <p>
            ข้อมูลรายชั่วโมงจาก Google Search Console ·
            วันและชั่วโมงอ้างอิงเวลาแปซิฟิก
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setVersion((v) => v + 1)}
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          {busy ? "กำลังตรวจสอบ…" : "ตรวจข้อมูลล่าสุด"}
        </Button>
      </div>
      <p className="notice mb-5">
        ข้อมูลเบื้องต้น ยังไม่สรุป · Google
        อาจส่งข้อมูลช้าหลายชั่วโมงและปรับยอดย้อนหลัง เว็บตรวจข้อมูลใหม่ทุก 15
        นาทีขณะเปิดแท็บ
      </p>
      {(error || data?.warning) && (
        <p role="alert" className="error mb-5">
          {error || data?.warning}
          {data?.available ? " · กำลังแสดงข้อมูลที่เก็บไว้ก่อนหน้า" : ""}
        </p>
      )}
      {!data && !error && <LoadingSkeleton variant="dashboard" />}
      {data && (
        <>
          <div
            className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-5"
            role="status"
          >
            <span className="pill">
              {data.stale || error
                ? "ข้อมูลที่เก็บไว้ · รออัปเดต"
                : "ข้อมูลเบื้องต้น"}
            </span>
            <span>วันที่รายงาน {formatDate(data.day)} (แปซิฟิก)</span>
            <span>
              Google มีข้อมูลถึง{" "}
              {data.latestHour
                ? pacificHour(data.latestHour) + " (แปซิฟิก)"
                : "ยังไม่มีชั่วโมงที่รายงาน"}
            </span>
            <span>
              เว็บดึงล่าสุด{" "}
              {data.fetchedAt
                ? formatDate(data.fetchedAt, true) + " (เวลาไทย)"
                : "ยังดึงไม่สำเร็จ"}
            </span>
            {data.refreshing && <span>มีคำขอกำลังอัปเดตข้อมูล</span>}
          </div>
          <div className="kpi-grid">
            {Object.entries(labels).map(([key, label]) => {
              const name = key as keyof typeof labels;
              const value = data.metrics[name];
              return (
                <Card key={key} className="kpi-card p-5">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-[30px] font-semibold tabular mt-3">
                    {data.hasData
                      ? name === "ctr"
                        ? (value * 100).toLocaleString("th-TH", {
                            maximumFractionDigits: 2,
                          }) + "%"
                        : value.toLocaleString("th-TH", {
                            maximumFractionDigits: name === "position" ? 1 : 0,
                          })
                      : "—"}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    เฉพาะชั่วโมงที่ Google ส่งข้อมูลแล้ว
                  </p>
                </Card>
              );
            })}
          </div>
          <Card className="mt-6">
            <div className="panel-title flex-wrap">
              <div>
                <h2>ประสิทธิภาพรายชั่วโมง</h2>
                <p className="text-xs text-muted-foreground mt-2">
                  เวลาแปซิฟิก · ชั่วโมงที่ขาดข้อมูลเว้นช่องว่างในกราฟ
                </p>
              </div>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(labels).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={metric === key ? "default" : "ghost"}
                    aria-pressed={metric === key}
                    onClick={() => setMetric(key as keyof typeof labels)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {data.hasData ? (
              <div className="p-3 pt-5">
                <PerformanceChart data={data.hours} metric={metric} hourly />
              </div>
            ) : (
              <div className="empty min-h-72">
                <h2>
                  {data.available
                    ? "Google ยังไม่ส่งข้อมูลของวันนี้"
                    : "ข้อมูลวันนี้ยังไม่พร้อม"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  ยังสรุปไม่ได้ว่าไม่มีคลิกหรือการแสดงผล
                  ระบบจะตรวจสอบใหม่อัตโนมัติ
                </p>
              </div>
            )}
          </Card>
          {data.firstIncompleteHour && (
            <p className="notice mt-4">
              ข้อมูลตั้งแต่ {pacificHour(data.firstIncompleteHour)} (แปซิฟิก)
              ยังอยู่ระหว่างประมวลผลและอาจเปลี่ยนแปลง
            </p>
          )}
          <p className="text-xs text-muted-foreground leading-6 mt-5">
            ยอดรวมระดับเว็บไซต์สำหรับการค้นหาเว็บ
            ข้อมูลชุดนี้แยกจากรายงานย้อนหลังและไม่ใช้คำนวณโอกาสปรับปรุง SEO
          </p>
        </>
      )}
    </>
  );
}
