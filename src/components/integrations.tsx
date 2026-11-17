"use client";
import { useSearchParams } from "next/navigation";
import { thaiLabel, formatDate } from "@/lib/locale";
import { useEffect, useState } from "react";
import {
  Link2,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ScanSearch,
  Clock3,
} from "lucide-react";
import { useWorkspace, useResource, api } from "./layout/workspace";
import { useAction } from "./action-center";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { EmptyProperty, ResourceState } from "./dashboard";
import type { Thresholds } from "@/lib/seo/analyzer";
type SettingsData = {
  credential: {
    tokenStatus: string;
    grantedScopes: string[];
    updatedAt: string;
  } | null;
  ownerUsername: string;
  defaultThresholds: Thresholds;
};
export function Settings() {
  const w = useWorkspace(),
    r = useResource<SettingsData>("settings?v=" + w.version),
    rules = useResource<Thresholds>(w.siteId ? "rules?" + w.query : null),
    action = useAction(),
    params = useSearchParams();
  const connection = params.get("connection"),
    callback =
      connection === "connected"
        ? "เชื่อมต่อสิทธิ์ Google แล้ว ค้นหาเว็บไซต์ของคุณได้ด้านล่าง"
        : connection === "failed"
          ? "เชื่อมต่อ Google ไม่สำเร็จ โปรดลองอีกครั้ง หากไม่มีสิทธิ์เข้าถึงเบื้องหลัง ให้เลือกเชื่อมต่อใหม่พร้อมขอความยินยอม"
          : "";
  const connect = (consent: boolean) =>
    action.run(async () => {
      const result = await api<{ url: string }>("google/connect", { consent });
      window.location.assign(result.url);
    }, "กำลังเปิดหน้าขอสิทธิ์ Google…");
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>ตั้งค่าพื้นที่ทำงาน</h1>
          <p>จัดการการเชื่อมต่อ เว็บไซต์ และเกณฑ์การวิเคราะห์</p>
        </div>
        <span className="pill">
          <CheckCircle2 size={12} />
          สำหรับเจ้าของเท่านั้น
        </span>
      </div>
      {(action.message || callback) && (
        <p className="notice mb-5" role="status">
          {action.message || callback}
        </p>
      )}
      <ResourceState loading={r.loading} error={r.error} />
      {r.data && (
        <>
          <Card className="mb-6">
            <div className="panel-title">
              <h2>Google Search Console</h2>
              <span
                className={
                  "pill " +
                  (r.data.credential?.tokenStatus === "ACTIVE"
                    ? "badge-green"
                    : "")
                }
              >
                {r.data.credential?.tokenStatus ? thaiLabel(r.data.credential.tokenStatus) : "ยังไม่เชื่อมต่อ"}
              </span>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <Link2 size={22} className="text-primary shrink-0" />
                <div>
                  <h3 className="font-medium">
                    อ่านข้อมูลผลการค้นหาได้เท่านั้น
                  </h3>
                  <p className="text-xs text-muted-foreground leading-6 mt-2 max-w-2xl">
                    ชื่อผู้ใช้และรหัสผ่านใช้เข้าสู่แอป ส่วนการอนุญาตนี้ให้ SearchPilot อ่านข้อมูล Search Console และซิงก์เบื้องหลัง โทเคนต่ออายุจะถูกเข้ารหัสบนเซิร์ฟเวอร์
                  </p>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap mt-6">
                <Button disabled={action.busy} onClick={() => connect(false)}>
                  {r.data.credential ? "เชื่อมต่อใหม่" : "เชื่อมต่อ Search Console"}
                  <ExternalLink size={14} />
                </Button>
                {r.data.credential && (
                  <>
                    <Button
                      variant="outline"
                      disabled={action.busy}
                      onClick={() => connect(true)}
                    >
                      เชื่อมต่อใหม่พร้อมขอความยินยอม
                    </Button>
                    <Button
                      variant="outline"
                      disabled={action.busy}
                      onClick={() =>
                        action.run(
                          () => api("sites/discover", {}),
                          "ค้นพบเว็บไซต์แล้ว เลือกเว็บไซต์จากเมนูด้านบน",
                        )
                      }
                    >
                      <RefreshCw size={14} />
                      ค้นหาเว็บไซต์
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={action.busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "ต้องการยกเลิกสิทธิ์ Search Console หรือไม่? ข้อมูลวิเคราะห์ที่บันทึกไว้จะยังคงอยู่",
                          )
                        )
                          void action.run(
                            () => api("google/disconnect", {}),
                            "ยกเลิกการเชื่อมต่อ Search Console แล้ว",
                          );
                      }}
                    >
                      ยกเลิกการเชื่อมต่อ
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
          <Card className="mb-6">
            <div className="panel-title">
              <h2>เว็บไซต์ใน Search Console</h2>
              <span className="text-xs text-muted-foreground">
                {w.sites.length} เว็บไซต์
              </span>
            </div>
            <div className="divide-y divide-border">
              {w.sites.map((s) => (
                <div
                  className="p-5 flex justify-between items-center gap-4"
                  key={s.id}
                >
                  <div className="min-w-0">
                    <p className="text-sm break-all">{s.siteUrl}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {s.propertyType === "DOMAIN" ? "โดเมน" : "URL ตามคำนำหน้าที่กำหนด"} ·{" "}
                      {thaiLabel(s.permission)}
                    </p>
                  </div>
                  <Button
                    variant={s.isDefault ? "ghost" : "outline"}
                    size="sm"
                    disabled={s.isDefault || action.busy}
                    onClick={() =>
                      action.run(() => api("sites/default", { siteId: s.id }))
                    }
                  >
                    {s.isDefault ? "ค่าเริ่มต้น" : "ตั้งเป็นค่าเริ่มต้น"}
                  </Button>
                </div>
              ))}
              {!w.sites.length && (
                <div className="p-6 text-sm text-muted-foreground">
                  เชื่อมต่อ Search Console แล้วค้นหาเว็บไซต์ ระบบจะเก็บรหัสเว็บไซต์ตามที่ Google ส่งกลับ
                </div>
              )}
            </div>
          </Card>
          <Card className="mb-6 p-6">
            <h2>เจ้าของที่ได้รับอนุญาต</h2>
            <p className="text-sm mt-3">{r.data.ownerUsername}</p>
            <p className="text-xs text-muted-foreground mt-2 leading-6">
              เซิร์ฟเวอร์ตรวจสิทธิ์ทุกคำขอด้วยรหัสเจ้าของ Neon ที่กำหนดไว้ รหัสผ่านและเซสชันจัดการโดย Neon Auth
            </p>
          </Card>
          {w.siteId && rules.data && (
            <Card>
              <div className="panel-title">
                <h2>เกณฑ์ค้นหาโอกาสปรับปรุง</h2>
                <span className="text-xs text-muted-foreground">
                  แยกตามเว็บไซต์ · {w.site?.displayName}
                </span>
              </div>
              <form
                key={w.siteId + "-" + w.version}
                className="p-6 form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    thresholds = Object.fromEntries(
                      [...f].map(([k, v]) => [k, Number(v)]),
                    );
                  void action.run(
                    () => api("rules", { siteId: w.siteId, thresholds }),
                    "บันทึกเกณฑ์แล้ว เรียกวิเคราะห์อีกครั้งเพื่ออัปเดตผล",
                  );
                }}
              >
                {Object.entries(rules.data).map(([key, value]) => (
                  <label key={key}>
                    {
                      (
                        {
                          minImpressions: "การแสดงผลขั้นต่ำ",
                          minClicks: "คลิกขั้นต่ำของช่วงฐาน",
                          quickMin: "โอกาสปรับปรุงเร็ว: อันดับต่ำสุด",
                          quickMax: "โอกาสปรับปรุงเร็ว: อันดับสูงสุด",
                          nearMin: "ใกล้หน้าแรก: อันดับต่ำสุด",
                          nearMax: "ใกล้หน้าแรก: อันดับสูงสุด",
                          drop: "สัดส่วนยอดคลิกที่ลดลง",
                          growth: "สัดส่วนการแสดงผลที่เพิ่มขึ้น",
                          weakClicks: "สัดส่วนคลิกที่เพิ่มขึ้นสูงสุด",
                          lowCtrRatio: "อัตราส่วน CTR เทียบค่ามัธยฐานกลุ่ม",
                          minPeers: "จำนวนรายการเปรียบเทียบขั้นต่ำ",
                          decay: "สัดส่วนการลดลงต่อช่วงเวลา",
                          overlapShare: "ส่วนแบ่งการแสดงผล URL ขั้นต่ำ",
                        } as Record<string, string>
                      )[key]
                    }
                    <Input
                      type="number"
                      name={key}
                      required
                      step={
                        ["minImpressions", "minClicks", "minPeers"].includes(
                          key,
                        )
                          ? "1"
                          : "0.01"
                      }
                      min="0"
                      defaultValue={value}
                    />
                  </label>
                ))}
                <div className="col-span-full mt-2">
                  <Button disabled={action.busy}>บันทึกเกณฑ์</Button>
                </div>
              </form>
            </Card>
          )}
          <p className="notice mt-5">
            การซิงก์รายวันอัปเดตข้อมูลที่สรุปแล้วในช่วง 7 วันย้อนหลัง เริ่มดึงข้อมูลย้อนหลัง 90 วันได้ที่ประวัติการซิงก์ ต้องเปิดตัวประมวลผลงานหรือตัวตั้งเวลาที่ผ่านการยืนยันสิทธิ์เพื่อประมวลผลคิวต่อเนื่อง
          </p>
        </>
      )}
    </>
  );
}
type Job = {
  id: string;
  status: string;
  syncType: string;
  startDate: string;
  endDate: string;
  attempts: number;
  checkpoint: { day: string; dataset: number; offset: number };
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  truncated: boolean;
};
export function SyncHistory() {
  const w = useWorkspace(),
    [tick, setTick] = useState(0),
    r = useResource<Job[]>(
      w.siteId ? "sync?" + w.query + "&poll=" + tick : null,
    ),
    action = useAction();
  useEffect(() => {
    if (!r.data?.some((j) => ["QUEUED", "RUNNING", "RETRY"].includes(j.status)))
      return;
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, [r.data]);
  const first = new Date(w.end);
  first.setUTCDate(first.getUTCDate() - 89);
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>ประวัติการซิงก์</h1>
          <p>
            ติดตามงานซิงก์ ความคืบหน้าที่ทำต่อได้ และความสดใหม่ของข้อมูล
          </p>
        </div>
        <Button variant="outline" onClick={() => setTick((t) => t + 1)}>
          <RefreshCw size={15} />
          รีเฟรช
        </Button>
      </div>
      {action.message && (
        <p className="notice mb-5" role="status">
          {action.message}
        </p>
      )}
      {!w.loading && !w.siteId ? (
        <EmptyProperty />
      ) : (
        <>
          <Card className="p-6 mb-6">
            <h2 className="mb-4">ซิงก์ข้อมูลย้อนหลัง</h2>
            <form
              className="flex flex-wrap gap-4 items-end"
              key={w.siteId}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action.run(
                  () =>
                    api("sync", {
                      siteId: w.siteId,
                      start: f.get("start"),
                      end: f.get("end"),
                    }),
                  "เพิ่มงานซิงก์ในคิวแล้ว ความคืบหน้าจะอัปเดตทุก 10 วินาทีขณะมีงานทำงานอยู่",
                );
              }}
            >
              <label>
                วันที่เริ่มต้น
                <Input
                  name="start"
                  type="date"
                  required
                  defaultValue={first.toISOString().slice(0, 10)}
                />
              </label>
              <label>
                วันที่สิ้นสุด
                <Input
                  name="end"
                  type="date"
                  required
                  max={w.end}
                  defaultValue={w.end}
                />
              </label>
              <Button disabled={!w.siteId || action.busy}>
                เพิ่มงานซิงก์ในคิว
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-4 leading-6">
              ค่าเริ่มต้น 90 วัน · ชุดข้อมูลแยกกัน 4 ชุด · การค้นหาเว็บ · เฉพาะข้อมูลที่สรุปแล้ว · วันที่รายงานตามเวลาแปซิฟิก
            </p>
          </Card>
          <ResourceState
            loading={w.loading || (r.loading && r.data === null)}
            error={r.error}
          />
          <div className="space-y-3">
            {r.data?.map((j) => (
              <Card className="p-5" key={j.id}>
                <div className="flex justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          "pill " +
                          (j.status === "SUCCEEDED" ? "badge-green" : "")
                        }
                      >
                        {thaiLabel(j.status)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {thaiLabel(j.syncType)}
                      </span>
                    </div>
                    <h3 className="font-medium mt-3">
                      {formatDate(j.startDate)} — {formatDate(j.endDate)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2">
                      จุดบันทึกความคืบหน้า: {formatDate(j.checkpoint.day)} ·{" "}
                      {
                        [
                          "เว็บไซต์รายวัน",
                          "คำค้นหารายวัน",
                          "หน้าเว็บรายวัน",
                          "คำค้นหาและหน้าเว็บรายวัน",
                        ][j.checkpoint.dataset]
                      }{" "}
                      · แถว {j.checkpoint.offset.toLocaleString("th-TH")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      จำนวนครั้งที่ประมวลผลช่วงข้อมูลล้มเหลวต่อเนื่อง: {j.attempts} · สร้างเมื่อ{" "}
                      {formatDate(j.createdAt, true)}
                    </p>
                    {j.errorMessage && (
                      <p className="text-xs text-destructive mt-3">
                        {j.errorMessage}
                      </p>
                    )}
                    {j.truncated && (
                      <p className="text-xs text-muted-foreground mt-3">
                        ถึงขีดจำกัดแถวต่อวันของ Google ข้อมูลจึงอาจไม่ครบ
                      </p>
                    )}
                  </div>
                  {j.status === "FAILED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={action.busy}
                      onClick={() =>
                        action.run(
                          () =>
                            api("sync/retry", { siteId: w.siteId, id: j.id }),
                          "เพิ่มงานลองใหม่จากจุดบันทึกล่าสุดแล้ว",
                        )
                      }
                    >
                      ลองใหม่จากจุดบันทึก
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            {!r.loading && !w.loading && !r.error && r.data?.length === 0 && (
              <Card>
                <div className="empty">
                  <Clock3 size={30} />
                  <h2>ยังไม่มีประวัติการซิงก์</h2>
                  <p className="text-xs text-muted-foreground">
                    เริ่มเพิ่มงานซิงก์ย้อนหลังครั้งแรกได้ด้านบน
                  </p>
                </div>
              </Card>
            )}
          </div>
          <p className="notice mt-5">
            งานซิงก์ทำงานแยกจากเซสชันเข้าสู่ระบบ ต้องเปิดตัวประมวลผลงานหรือเรียก cron ที่ผ่านการยืนยันสิทธิ์ ระบบจะแทนที่รายงานเดิมเมื่อข้อมูลรายวันครบเท่านั้น และเก็บจุดบันทึกไว้เมื่อลองใหม่
          </p>
        </>
      )}
    </>
  );
}
type Inspection = {
  id: string;
  page: string;
  verdict: string | null;
  coverage: string | null;
  rawResult: unknown;
  inspectedAt: string;
};
export function Inspections() {
  const w = useWorkspace(),
    r = useResource<Inspection[]>(w.siteId ? "inspections?" + w.query : null),
    action = useAction();
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>ตรวจสอบ URL</h1>
          <p>ดูข้อมูล URL เวอร์ชันที่ Google จัดทำดัชนีไว้</p>
        </div>
        <span className="pill">เวอร์ชันที่จัดทำดัชนี</span>
      </div>
      {action.message && (
        <p className="notice mb-5" role="status">
          {action.message}
        </p>
      )}
      {!w.loading && !w.siteId ? (
        <EmptyProperty />
      ) : (
        <>
          <Card className="p-6 mb-6">
            <form
              className="flex flex-wrap gap-4 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                const page = new FormData(e.currentTarget).get("page");
                void action.run(
                  () => api("inspections", { siteId: w.siteId, page }),
                  "บันทึกผลตรวจสอบในประวัติแล้ว",
                );
              }}
            >
              <label className="flex-1 min-w-48">
                URL แบบเต็ม
                <Input
                  name="page"
                  type="url"
                  required
                  placeholder="https://your-site.com/page"
                />
              </label>
              <Button disabled={!w.siteId || action.busy}>
                <ScanSearch size={16} />
                {action.busy ? "กำลังตรวจสอบ…" : "ตรวจสอบ URL"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-4 leading-6">
              ตรวจสอบเวอร์ชันที่ Google จัดทำดัชนีไว้ ไม่ใช่การทดสอบ URL ปัจจุบัน และไม่สามารถขอจัดทำดัชนีได้ แอปจำกัด 10 ครั้งต่อนาที และยังอยู่ภายใต้โควตาของ Google
            </p>
          </Card>
          <ResourceState loading={r.loading || w.loading} error={r.error} />
          <div className="space-y-4">
            {r.data?.map((i) => (
              <Card key={i.id} className="p-6">
                <div className="flex gap-3 justify-between flex-wrap">
                  <h2 className="break-all text-sm">{i.page}</h2>
                  <span className="pill">{thaiLabel(i.verdict || "UNKNOWN")}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  {i.coverage ? thaiLabel(i.coverage) : "Google ไม่ได้ส่งสถานะการจัดทำดัชนีกลับมา"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDate(i.inspectedAt, true)}
                </p>
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer text-primary">
                    ดูรายละเอียดผลตรวจสอบทั้งหมด
                  </summary>
                  <pre>{JSON.stringify(i.rawResult, null, 2)}</pre>
                </details>
              </Card>
            ))}
            {!r.loading && !w.loading && !r.error && r.data?.length === 0 && (
              <Card>
                <div className="empty">
                  <ScanSearch size={30} />
                  <h2>ยังไม่มีประวัติการตรวจสอบ</h2>
                  <p className="text-xs text-muted-foreground">
                    ตรวจสอบ URL ที่อยู่ในเว็บไซต์ที่เลือกเพื่อบันทึกสถานะการจัดทำดัชนี
                  </p>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}
