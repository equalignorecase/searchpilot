"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { thaiLabel, formatDate } from "@/lib/locale";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Download,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  GitCompare,
  ArrowUpRight,
} from "lucide-react";
import { useWorkspace, useResource, api } from "./layout/workspace";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { EmptyProperty, ResourceState, number } from "./dashboard";
import { PerformanceChart, type Daily } from "./charts/performance";
import type { TableRow } from "@/features/analytics/service";
type HistoryData = {
  daily: Daily[];
  related: TableRow[];
  targets: {
    page: string;
    pageType: string;
    targetKeyword: string | null;
    notes: string;
  }[];
  changes: {
    id: string;
    title: string;
    description: string;
    changedAt: string;
    afterEnd: string;
    before: { clicks: number; impressions: number };
    after: { clicks: number; impressions: number };
  }[];
};
export function AnalyticsWorkspace({
  dimension,
}: {
  dimension: "query" | "page";
}) {
  const w = useWorkspace();
  return (
    <AnalyticsContent key={w.siteId + w.start + w.end} dimension={dimension} />
  );
}
function AnalyticsContent({ dimension }: { dimension: "query" | "page" }) {
  const w = useWorkspace(),
    isPage = dimension === "page",
    route = isPage ? "pages" : "keywords";
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [page, setPage] = useState(1),
    [sort, setSort] = useState("clicks"),
    [direction, setDirection] = useState<"asc" | "desc">("desc"),
    [selected, setSelected] = useState<string[]>([]),
    [detail, setDetail] = useState<string | null>(null),
    [comparing, setComparing] = useState(false),
    [error, setError] = useState("");
  const query =
    w.query +
    "&" +
    new URLSearchParams({
      ...filters,
      page: String(page),
      sort,
      direction,
    }).toString();
  const resource = useResource<{
    rows: TableRow[];
    total: number;
    pageSize: number;
  }>(w.siteId ? route + "?" + query : null);
  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        accessorKey: "label",
        header: isPage ? "URL หน้าเว็บ" : "คีย์เวิร์ด",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {isPage && (
              <input
                type="checkbox"
                aria-label={"เปรียบเทียบ " + row.original.label}
                checked={selected.includes(row.original.label)}
                disabled={
                  selected.length >= 2 && !selected.includes(row.original.label)
                }
                onChange={(e) =>
                  setSelected((s) =>
                    e.target.checked
                      ? [...s, row.original.label]
                      : s.filter((x) => x !== row.original.label),
                  )
                }
              />
            )}
            <button
              className="link text-left max-w-80 truncate"
              title={row.original.label}
              onClick={() => setDetail(row.original.label)}
            >
              {row.original.label}
            </button>
          </div>
        ),
      },
      {
        accessorKey: "clicks",
        header: "คลิก",
        cell: ({ getValue }) => number(getValue<number>()),
      },
      {
        accessorKey: "impressions",
        header: "การแสดงผล",
        cell: ({ getValue }) => number(getValue<number>()),
      },
      {
        accessorKey: "ctr",
        header: "CTR",
        cell: ({ getValue }) => number(getValue<number>() * 100, 2) + "%",
      },
      {
        accessorKey: "position",
        header: "อันดับเฉลี่ย",
        cell: ({ getValue }) => number(getValue<number>(), 1),
      },
      ...(["clickChange", "impressionChange", "positionChange"] as const).map(
        (key) => ({
          accessorKey: key,
          header: {
            clickChange: "การเปลี่ยนแปลงคลิก",
            impressionChange: "การเปลี่ยนแปลงการแสดงผล",
            positionChange: "การเปลี่ยนแปลงอันดับ",
          }[key],
          cell: ({ getValue }: { getValue: () => unknown }) => {
            const v = getValue() as number | null;
            return v === null
              ? "—"
              : (v > 0 ? "+" : "") +
                  number(v, 1) +
                  (key === "positionChange" ? "" : "%");
          },
        }),
      ),
    ],
    [isPage, selected],
  );
  // TanStack v8 uses mutable table state; this component is not React Compiler memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: resource.data?.rows || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });
  function apply(form: HTMLFormElement) {
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    setFilters(
      Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "")),
    );
    setPage(1);
    setSelected([]);
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>{isPage ? "ประสิทธิภาพหน้าเว็บ" : "วิเคราะห์คีย์เวิร์ด"}</h1>
          <p>
            {isPage
              ? "ดูว่า URL ใดได้รับความสนใจ และหน้าใดควรปรับปรุง"
              : "ทำความเข้าใจคำค้นหาที่นำผู้คนมายังเว็บไซต์ของคุณ"}
          </p>
        </div>
        <div className="flex gap-2">
          {isPage && (
            <Button
              variant="outline"
              disabled={selected.length !== 2}
              onClick={() => setComparing(true)}
            >
              <GitCompare size={15} />
              เปรียบเทียบ {selected.length ? `(${selected.length})` : ""}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!w.siteId}
            onClick={async () => {
              setError("");
              try {
                const response = await fetch(
                  "/api/" + route + "?" + query + "&format=csv",
                );
                if (!response.ok) {
                  const d = await response.json();
                  throw new Error(d.error);
                }
                const blob = await response.blob(),
                  url = URL.createObjectURL(blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = "searchpilot-" + route + ".csv";
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Download size={15} />
            ส่งออก CSV
          </Button>
        </div>
      </div>
      {error && (
        <p className="error mb-4" role="alert">
          {error}
        </p>
      )}
      {!w.loading && !w.siteId ? (
        <EmptyProperty />
      ) : (
        <>
          <Card className="mb-5 p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                apply(e.currentTarget);
              }}
              className="flex flex-wrap gap-3 items-end"
            >
              <label className="flex-1 min-w-44">
                <span>{isPage ? "ค้นหา URL" : "ค้นหาคีย์เวิร์ด"}</span>
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute top-3 left-3 text-muted-foreground"
                  />
                  <Input
                    name="search"
                    placeholder={isPage ? "ค้นหา URL…" : "ค้นหาคีย์เวิร์ด…"}
                    className="pl-9"
                  />
                </div>
              </label>
              {[
                {
                  name: "minImpressions",
                  label: "การแสดงผลขั้นต่ำ",
                  max: undefined,
                },
                { name: "minClicks", label: "คลิกขั้นต่ำ", max: undefined },
                { name: "minPosition", label: "อันดับตั้งแต่", max: "1000" },
                { name: "maxPosition", label: "ถึงอันดับ", max: "1000" },
                { name: "minCtr", label: "CTR ตั้งแต่ (0–1)", max: "1" },
                { name: "maxCtr", label: "CTR ถึง (0–1)", max: "1" },
              ].map((f) => (
                <label className="w-28" key={f.name}>
                  {f.label}
                  <Input
                    name={f.name}
                    type="number"
                    min="0"
                    max={f.max}
                    step={f.name.includes("Ctr") ? "0.001" : "1"}
                  />
                </label>
              ))}
              <Button disabled={!w.siteId}>ใช้ตัวกรอง</Button>
            </form>
          </Card>
          <ResourceState
            variant="table"
            loading={resource.loading || w.loading}
            error={resource.error}
          />
          {resource.data && !resource.loading && (
            <Card>
              <div className="panel-title">
                <h2>
                  {isPage ? "หน้าเว็บปลายทาง" : "คำค้นหา"}{" "}
                  <span className="text-muted-foreground font-normal text-xs ml-2">
                    {number(resource.data.total)} รายการ
                  </span>
                </h2>
                <span className="text-[11px] text-muted-foreground">
                  เทียบกับช่วงก่อนหน้าที่มีจำนวนวันเท่ากัน
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((group) => (
                      <tr key={group.id}>
                        {group.headers.map((h) => (
                          <th
                            key={h.id}
                            aria-sort={
                              sort === h.column.id
                                ? direction === "asc"
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                          >
                            <button
                              className="inline-flex items-center gap-1.5"
                              onClick={() => {
                                setSort(h.column.id);
                                setDirection(
                                  sort === h.column.id && direction === "desc"
                                    ? "asc"
                                    : "desc",
                                );
                                setPage(1);
                              }}
                            >
                              {flexRender(
                                h.column.columnDef.header,
                                h.getContext(),
                              )}
                              <ArrowUpDown size={11} />
                            </button>
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!resource.data.rows.length && (
                <div className="empty">
                  <Search size={28} />
                  <h2>ไม่พบข้อมูลที่ตรงกัน</h2>
                  <p className="text-xs text-muted-foreground">
                    ลองเปลี่ยนตัวกรองหรือซิงก์ข้อมูลสำหรับช่วงเวลานี้
                  </p>
                </div>
              )}
              <div className="p-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  หน้า {page} จาก{" "}
                  {Math.max(1, Math.ceil(resource.data.total / 25))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={14} />
                    ก่อนหน้า
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * 25 >= resource.data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    ถัดไป
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          )}
          <p className="text-[11px] text-muted-foreground mt-4 leading-5">
            CTR คือจำนวนคลิกหารด้วยจำนวนการแสดงผล อันดับเฉลี่ยถ่วงน้ำหนักด้วยการแสดงผล การเปลี่ยนแปลงอันดับที่ติดลบหมายถึงอันดับดีขึ้น หากไม่มีข้อมูลเปรียบเทียบจะแสดง — ส่งออก CSV ได้สูงสุด 10,000 แถวที่ผ่านตัวกรอง พร้อมป้องกันการทำงานของสูตรในสเปรดชีต
          </p>
        </>
      )}
      {detail && (
        <DetailDialog
          value={detail}
          dimension={dimension}
          close={() => setDetail(null)}
        />
      )}
      {comparing && (
        <Modal title="เปรียบเทียบหน้าเว็บ" close={() => setComparing(false)}>
          <div className="two-col">
            {selected.map((value) => (
              <div key={value}>
                <h3 className="text-xs break-all mb-4">{value}</h3>
                <HistoryChart dimension="page" value={value} />
              </div>
            ))}
          </div>
          <p className="notice mt-4">
            แต่ละหน้าใช้ชุดข้อมูลหน้าเว็บที่รวมผลแยกกันตามช่วงวันที่เลือก
          </p>
        </Modal>
      )}
    </>
  );
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-label={title}
    >
      <header className="panel-title">
        <h2 className="break-all pr-3">{title}</h2>
        <Button
          size="icon"
          variant="ghost"
          aria-label="ปิดหน้าต่าง"
          onClick={close}
        >
          <X size={18} />
        </Button>
      </header>
      <div>{children}</div>
    </dialog>
  );
}
function HistoryChart({
  dimension,
  value,
}: {
  dimension: "query" | "page";
  value: string;
}) {
  const w = useWorkspace(),
    r = useResource<HistoryData>(
      "history?" + w.query + "&" + new URLSearchParams({ dimension, value }),
    );
  return (
    <>
      <ResourceState loading={r.loading} error={r.error} variant="chart" />
      {r.data &&
        (r.data.daily.length ? (
          <PerformanceChart data={r.data.daily} />
        ) : (
          <p className="notice">ไม่มีข้อมูลสำหรับช่วงเวลานี้</p>
        ))}
    </>
  );
}
function DetailDialog({
  value,
  dimension,
  close,
}: {
  value: string;
  dimension: "query" | "page";
  close: () => void;
}) {
  const w = useWorkspace(),
    r = useResource<HistoryData>(
      "history?" + w.query + "&" + new URLSearchParams({ dimension, value }),
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(path: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await api(path, body);
      setMessage("บันทึกแล้ว");
      w.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={value} close={close}>
      <ResourceState loading={r.loading} error={r.error} variant="chart" />
      {message && (
        <p role="status" className="notice mb-4">
          {message}
        </p>
      )}
      {r.data && (
        <>
          <div className="mb-6">
            {r.data.daily.length ? (
              <PerformanceChart data={r.data.daily} />
            ) : (
              <p className="notice">ไม่มีประวัติสำหรับช่วงวันที่นี้</p>
            )}
          </div>
          <h2 className="mb-4">
            {dimension === "query"
              ? "หน้าเว็บปลายทางที่เกี่ยวข้อง"
              : "คำค้นหาที่เกี่ยวข้อง"}
          </h2>
          <div className="overflow-auto max-h-72">
            <table className="w-full">
              <thead>
                <tr>
                  <th>{dimension === "query" ? "URL" : "คำค้นหา"}</th>
                  <th>คลิก</th>
                  <th>การแสดงผล</th>
                  <th>อันดับ</th>
                </tr>
              </thead>
              <tbody>
                {r.data.related.map((row) => (
                  <tr key={row.label}>
                    <td className="max-w-80 break-all">
                      {dimension === "query" ? (
                        <a
                          href={row.label}
                          target="_blank"
                          rel="noreferrer"
                          className="link"
                        >
                          {row.label}
                          <ArrowUpRight size={12} className="inline" />
                        </a>
                      ) : (
                        row.label
                      )}
                    </td>
                    <td>{number(row.clicks)}</td>
                    <td>{number(row.impressions)}</td>
                    <td>{number(row.position, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dimension === "page" && (
            <>
              <h2 className="mt-8 mb-4">เป้าหมายของหน้าเว็บ</h2>
              <form
                key={w.version}
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void submit("targets", {
                    siteId: w.siteId,
                    page: value,
                    pageType: f.get("pageType"),
                    targetKeyword: f.get("targetKeyword") || null,
                    notes: f.get("notes"),
                  });
                }}
              >
                <label>
                  ประเภทหน้าเว็บ
                  <select
                    name="pageType"
                    defaultValue={r.data.targets[0]?.pageType || "Other"}
                  >
                    {[
                      "Product",
                      "Category",
                      "Blog",
                      "Landing Page",
                      "Other",
                    ].map((t) => (
                      <option key={t} value={t}>{thaiLabel(t)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  คีย์เวิร์ดเป้าหมายหลัก
                  <Input
                    name="targetKeyword"
                    maxLength={2048}
                    defaultValue={r.data.targets[0]?.targetKeyword || ""}
                  />
                </label>
                <label className="col-span-full">
                  หมายเหตุ
                  <textarea
                    name="notes"
                    maxLength={10000}
                    defaultValue={r.data.targets[0]?.notes || ""}
                  />
                </label>
                <Button disabled={busy}>บันทึกเป้าหมายหน้าเว็บ</Button>
              </form>
              <h2 className="mt-8 mb-4">บันทึกการปรับปรุง SEO</h2>
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void submit("changes", {
                    siteId: w.siteId,
                    page: value,
                    title: f.get("title"),
                    description: f.get("description"),
                    changedAt: f.get("changedAt"),
                  });
                }}
              >
                <label>
                  ประเภทการเปลี่ยนแปลง
                  <select name="title">
                    {[
                      "แก้ไขชื่อหน้า",
                      "แก้ไขคำอธิบายเมตา",
                      "ปรับปรุงลิงก์ภายใน",
                      "ปรับปรุงเนื้อหา",
                      "เปลี่ยน Canonical",
                    ].map((t) => (
                      <option key={t} value={t}>{thaiLabel(t)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  วันที่เปลี่ยนแปลง
                  <Input
                    name="changedAt"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </label>
                <label className="col-span-full">
                  รายละเอียดการเปลี่ยนแปลง
                  <textarea name="description" maxLength={10000} required />
                </label>
                <Button disabled={busy}>บันทึกการเปลี่ยนแปลง</Button>
              </form>
              <h2 className="mt-8 mb-4">ผลลัพธ์ที่สังเกตได้</h2>
              {r.data.changes.map((c) => (
                <Card className="p-4 mb-3" key={c.id}>
                  <h3 className="font-medium">{c.title}</h3>
                  <p className="text-xs text-muted-foreground my-2">
                    {formatDate(c.changedAt)} · {c.description}
                  </p>
                  <p className="text-xs">
                    คลิกใน 28 วันก่อนหน้า:{" "}
                    {c.before.impressions ? number(c.before.clicks) : "ไม่มีข้อมูล"}{" "}
                    · หลังเปลี่ยนแปลง:{" "}
                    {c.after.impressions ? number(c.after.clicks) : "ไม่มีข้อมูล"}{" "}
                    (ถึง {formatDate(c.afterEnd)})
                  </p>
                </Card>
              ))}
              <p className="notice mt-4">
                ข้อมูลหลังเปลี่ยนแปลงอาจยังไม่ครบจนกว่าจะผ่านไป 28 วันและซิงก์ข้อมูลแล้ว ความสัมพันธ์ของข้อมูลไม่ได้ยืนยันว่าการแก้ไขเป็นสาเหตุให้ผลการค้นหาเปลี่ยนไป
              </p>
            </>
          )}
          {dimension === "query" && (
            <p className="notice mt-4">
              หากต้องการกำหนด URL หลักสำหรับคีย์เวิร์ดนี้ ให้เปิดหน้าเว็บในเมนูหน้าเว็บแล้วบันทึกคีย์เวิร์ดเป้าหมาย การมีหลาย URL ติดอันดับไม่ได้หมายความว่าเกิดการแข่งขันกันเองที่เป็นผลเสียเสมอไป
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
