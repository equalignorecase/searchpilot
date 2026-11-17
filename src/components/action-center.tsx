"use client";
import { useState } from "react";
import { thaiLabel, formatDate, findingText } from "@/lib/locale";
import {
  Plus,
  Trash2,
  Pencil,
  Lightbulb,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { useWorkspace, useResource, api } from "./layout/workspace";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { EmptyProperty, ResourceState, number } from "./dashboard";
import { Modal } from "./analytics-workspace";
import { OpportunityResults, type Opportunity } from "./opportunity-results";
export function useAction() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const w = useWorkspace();
  async function run(action: () => Promise<unknown>, success = "บันทึกแล้ว") {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
      w.refresh();
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, run };
}
export function Opportunities() {
  const w = useWorkspace();
  return <OpportunityList key={w.siteId + w.start + w.end} />;
}
function OpportunityList() {
  const w = useWorkspace(),
    [type, setType] = useState("ALL"),
    [status, setStatus] = useState("OPEN"),
    [sort, setSort] = useState("score"),
    [page, setPage] = useState(1),
    r = useResource<{ rows: Opportunity[]; total: number; page: number; pageSize: number }>(
      w.siteId ? "opportunities?" + w.query + "&" + new URLSearchParams({ type, status, order: sort, page: String(page) }) : null,
    ),
    action = useAction();
  const rows = r.data?.rows || [],
    currentPage = r.data?.page || page,
    total = r.data?.total || 0,
    pageSize = r.data?.pageSize || 10,
    pageCount = Math.max(1, Math.ceil(total / pageSize));
  function changePage(next: number) {
    setPage(next);
    window.scrollTo(0, 0);
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>โอกาสปรับปรุง</h1>
          <p>คำแนะนำที่ลงมือทำได้จากผลการค้นหาของคุณเอง</p>
        </div>
        <Button
          disabled={!w.siteId || action.busy}
          onClick={() =>
            action.run(
              () => api("opportunities/analyze", { siteId: w.siteId }),
              "วิเคราะห์เสร็จแล้ว อัปเดตผลเรียบร้อย",
            )
          }
        >
          <RefreshCw size={15} />
          วิเคราะห์ 28 วันล่าสุด
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
          <div className="flex flex-wrap gap-3 mb-5">
            <label>
              เกณฑ์วิเคราะห์
              <select aria-label="เกณฑ์วิเคราะห์" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                <option value="ALL">ทุกเกณฑ์</option>
                {[
                  "QUICK_WIN",
                  "LOW_CTR",
                  "NEAR_FIRST_PAGE",
                  "TRAFFIC_DROP",
                  "IMPRESSION_GROWTH",
                  "POTENTIAL_CANNIBALIZATION",
                  "CONTENT_DECAY",
                ].map((t) => (
                  <option key={t} value={t}>
                    {thaiLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              สถานะ
              <select
                aria-label="สถานะโอกาสปรับปรุง"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              >
                {["OPEN", "DISMISSED", "RESOLVED", "ALL"].map((s) => (
                  <option key={s} value={s}>{thaiLabel(s)}</option>
                ))}
              </select>
            </label>
            <label>
              เรียงตาม
              <select aria-label="เรียงโอกาสปรับปรุงตาม" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                <option value="score">คะแนนผลกระทบ</option>
                <option value="confidence">ความเชื่อมั่น</option>
              </select>
            </label>
          </div>
          <ResourceState loading={r.loading || w.loading} error={r.error} />
          {!r.loading && !w.loading && !r.error && (
            <div className="space-y-4">
              {rows.length > 0 && (
                <OpportunityResults
                  rows={rows}
                  busy={action.busy}
                  onCreate={(o) => {
                    void action.run(
                      () => api("tasks", {
                        siteId: w.siteId,
                        opportunityId: o.id,
                        title: thaiLabel(o.type) + ": " + (o.query || o.page || "ตรวจทาน"),
                        description: findingText(o.nextAction),
                        page: o.page,
                        query: o.query,
                        priority: o.score >= 70 ? "HIGH" : "MEDIUM",
                      }),
                      "สร้างงานในศูนย์งาน SEO แล้ว",
                    );
                  }}
                  onDismiss={(o) => {
                    void action.run(() => api("opportunities", {
                      siteId: w.siteId,
                      id: o.id,
                      status: o.status === "DISMISSED" ? "OPEN" : "DISMISSED",
                    }, "PATCH"));
                  }}
                />
              )}
              {total > 0 && (
                <nav aria-label="การแบ่งหน้าโอกาสปรับปรุง" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
                  <p role="status">
                    แสดง {number((currentPage - 1) * pageSize + 1)}–{number(Math.min(currentPage * pageSize, total))} จาก {number(total)} รายการ · หน้า {number(currentPage)} จาก {number(pageCount)}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={currentPage <= 1 || action.busy} onClick={() => changePage(currentPage - 1)}>ก่อนหน้า</Button>
                    <Button size="sm" variant="outline" disabled={currentPage >= pageCount || action.busy} onClick={() => changePage(currentPage + 1)}>ถัดไป</Button>
                  </div>
                </nav>
              )}
              {!rows.length && (
                <Card>
                  <div className="empty">
                    <Lightbulb size={30} />
                    <h2>ไม่พบโอกาสปรับปรุงตามตัวกรองนี้</h2>
                    <p className="text-xs text-muted-foreground max-w-md leading-6">
                      ซิงก์ข้อมูลอย่างน้อย 28 วันก่อนวิเคราะห์ เกณฑ์การลดลงและเนื้อหาเสื่อมประสิทธิภาพต้องใช้ช่วงก่อนหน้าที่มีจำนวนวันเท่ากันด้วย
                    </p>
                  </div>
                </Card>
              )}
            </div>
          )}
          <p className="notice mt-5">
            วิเคราะห์จากข้อมูลเว็บที่สรุปแล้ว สูงสุด 5,000 แถวที่มีการแสดงผลมากที่สุดต่อชุดคำค้นหา หน้าเว็บ และคำค้นหา–URL ในแต่ละช่วง กลุ่มเปรียบเทียบ CTR อยู่ในช่วงอันดับเดียวกันของเว็บไซต์นี้ แต่อุปกรณ์และแบรนด์อาจต่างกัน คะแนนใช้จัดลำดับการตรวจทาน ไม่ใช่คาดการณ์อันดับ ปรับเกณฑ์ได้ในเมนูตั้งค่า
          </p>
        </>
      )}
    </>
  );
}
type Task = {
  id: string;
  title: string;
  description: string;
  page: string | null;
  query: string | null;
  priority: string;
  status: string;
  completedAt: string | null;
};
export function Tasks() {
  const w = useWorkspace(),
    r = useResource<Task[]>(w.siteId ? "tasks?" + w.query : null),
    action = useAction(),
    [editing, setEditing] = useState<Task | true | null>(null),
    [filter, setFilter] = useState("ALL");
  const rows = (r.data || []).filter(
    (t) => filter === "ALL" || t.status === filter,
  );
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>ศูนย์งาน SEO</h1>
          <p>วางแผนงาน SEO ให้ชัดเจนและติดตามความคืบหน้า</p>
        </div>
        <Button disabled={!w.siteId} onClick={() => setEditing(true)}>
          <Plus size={16} />
          สร้างงานใหม่
        </Button>
      </div>
      {action.message && (
        <p className="notice mb-4" role="status">
          {action.message}
        </p>
      )}
      {!w.loading && !w.siteId ? (
        <EmptyProperty />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {["ALL", "TODO", "IN_PROGRESS", "DONE", "DISMISSED"].map((s) => (
              <Button
                variant={filter === s ? "default" : "outline"}
                size="sm"
                key={s}
                onClick={() => setFilter(s)}
              >
                {thaiLabel(s)}{" "}
                <span className="opacity-70 ml-1">
                  {s === "ALL"
                    ? r.data?.length || 0
                    : r.data?.filter((t) => t.status === s).length || 0}
                </span>
              </Button>
            ))}
          </div>
          <ResourceState loading={r.loading || w.loading} error={r.error} />
          <div className="space-y-3">
            {rows.map((t) => (
              <Card className="p-5" key={t.id}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-40">
                    <h2>{t.title}</h2>
                    <p className="text-xs text-muted-foreground leading-6 mt-2 whitespace-pre-wrap">
                      {t.description}
                    </p>
                    {t.page && (
                      <p className="text-xs mt-2 break-all text-muted-foreground">
                        {t.page}
                      </p>
                    )}
                    {t.query && (
                      <p className="text-xs mt-1 text-muted-foreground">
                        คีย์เวิร์ด: {t.query}
                      </p>
                    )}
                    {t.completedAt && (
                      <p className="text-xs mt-3 text-primary">
                        เสร็จเมื่อ {formatDate(t.completedAt, true)}
                      </p>
                    )}
                  </div>
                  <label>
                    <span className="sr-only">ความสำคัญของ {t.title}</span>
                    <select
                      aria-label={"ความสำคัญของ " + t.title}
                      value={t.priority}
                      disabled={action.busy}
                      onChange={(e) =>
                        action.run(() =>
                          api(
                            "tasks",
                            {
                              siteId: w.siteId,
                              id: t.id,
                              priority: e.target.value,
                            },
                            "PATCH",
                          ),
                        )
                      }
                    >
                      {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                        <option key={p} value={p}>{thaiLabel(p)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">สถานะของ {t.title}</span>
                    <select
                      aria-label={"สถานะของ " + t.title}
                      value={t.status}
                      disabled={action.busy}
                      onChange={(e) =>
                        action.run(() =>
                          api(
                            "tasks",
                            {
                              siteId: w.siteId,
                              id: t.id,
                              status: e.target.value,
                            },
                            "PATCH",
                          ),
                        )
                      }
                    >
                      {["TODO", "IN_PROGRESS", "DONE", "DISMISSED"].map((p) => (
                        <option key={p} value={p}>{thaiLabel(p)}</option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={"แก้ไข " + t.title}
                    onClick={() => setEditing(t)}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={action.busy}
                    aria-label={"ลบ " + t.title}
                    onClick={() => {
                      if (window.confirm("ต้องการลบงาน SEO นี้หรือไม่?"))
                        void action.run(
                          () =>
                            api(
                              "tasks",
                              { siteId: w.siteId, id: t.id },
                              "DELETE",
                            ),
                          "ลบงานแล้ว",
                        );
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          {!r.loading && !w.loading && !r.error && !rows.length && (
            <Card>
              <div className="empty">
                <ListChecks size={30} />
                <h2>จัดงานให้ชัดเจน พร้อมลงมือทำ</h2>
                <p className="text-xs text-muted-foreground">
                  สร้างงานที่นี่หรือเริ่มจากโอกาสปรับปรุง
                </p>
              </div>
            </Card>
          )}
        </>
      )}
      {editing && (
        <Modal
          title={editing === true ? "สร้างงาน SEO" : "แก้ไขงาน SEO"}
          close={() => setEditing(null)}
        >
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                body = {
                  siteId: w.siteId,
                  ...(editing !== true ? { id: editing.id } : {}),
                  title: f.get("title"),
                  description: f.get("description"),
                  page: f.get("page") || null,
                  query: f.get("query") || null,
                  priority: f.get("priority"),
                  status: f.get("status"),
                };
              if (
                await action.run(() =>
                  api("tasks", body, editing === true ? "POST" : "PATCH"),
                )
              )
                setEditing(null);
            }}
          >
            <label className="col-span-full">
              ชื่องาน
              <Input
                required
                name="title"
                maxLength={200}
                defaultValue={editing !== true ? editing.title : ""}
              />
            </label>
            <label className="col-span-full">
              รายละเอียด
              <textarea
                name="description"
                maxLength={10000}
                defaultValue={editing !== true ? editing.description : ""}
              />
            </label>
            <label>
              URL
              <Input
                name="page"
                type="url"
                defaultValue={editing !== true ? editing.page || "" : ""}
              />
            </label>
            <label>
              คีย์เวิร์ด
              <Input
                name="query"
                maxLength={2048}
                defaultValue={editing !== true ? editing.query || "" : ""}
              />
            </label>
            <label>
              ความสำคัญ
              <select
                name="priority"
                defaultValue={editing !== true ? editing.priority : "MEDIUM"}
              >
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                  <option key={p} value={p}>{thaiLabel(p)}</option>
                ))}
              </select>
            </label>
            <label>
              สถานะ
              <select
                name="status"
                defaultValue={editing !== true ? editing.status : "TODO"}
              >
                {["TODO", "IN_PROGRESS", "DONE", "DISMISSED"].map((p) => (
                  <option key={p} value={p}>{thaiLabel(p)}</option>
                ))}
              </select>
            </label>
            <Button disabled={action.busy}>บันทึกงาน</Button>
            {action.message && (
              <p className="text-xs text-destructive" role="status">
                {action.message}
              </p>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
