"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { thaiLabel, formatDate, findingText } from "@/lib/locale";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Modal } from "./analytics-workspace";
import { OpportunityEvidence } from "./opportunity-evidence";
export type Opportunity = {
  id: string;
  type: string;
  query: string | null;
  page: string | null;
  score: number;
  confidence: number;
  explanation: string;
  nextAction: string;
  evidence: Record<string, unknown>;
  status: string;
  detectedAt: string;
};
type Actions = {
  busy: boolean;
  onCreate: (opportunity: Opportunity) => void;
  onDismiss: (opportunity: Opportunity) => void;
};
const name = (o: Opportunity) => o.query || o.page || "โอกาสปรับปรุงเว็บไซต์";
const confidence = (value: number) => new Intl.NumberFormat("th-TH", {style: "percent", maximumFractionDigits: 0}).format(value);
function OpportunityActions({ opportunity: o, busy, onCreate, onDismiss, onView }: Actions & {
  opportunity: Opportunity;
  onView: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="ghost" aria-label={"ดูรายละเอียด " + name(o)} onClick={onView}>ดูรายละเอียด</Button>
      <Button size="sm" variant="outline" disabled={busy} aria-label={"สร้างงาน " + name(o)} onClick={() => onCreate(o)}><Plus size={14} />สร้างงาน</Button>
      <Button size="sm" variant="ghost" disabled={busy} aria-label={(o.status === "DISMISSED" ? "เรียกคืน " : "ละเว้น ") + name(o)} onClick={() => onDismiss(o)}>{o.status === "DISMISSED" ? "เรียกคืน" : "ละเว้น"}</Button>
    </div>
  );
}
export function OpportunityResults({ rows, ...actions }: { rows: Opportunity[] } & Actions) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find(o => o.id === selectedId);
  return (
    <>
      <Card className="hidden lg:block">
        <div className="data-table-scroll" role="region" aria-label="ตารางโอกาสปรับปรุง" tabIndex={0}>
          <table className="w-full min-w-[960px]">
            <caption className="sr-only">โอกาสปรับปรุง SEO เรียงตามตัวเลือกด้านบน</caption>
            <thead><tr>
              <th scope="col">คีย์เวิร์ด / URL</th><th scope="col">ประเภท</th><th scope="col">คะแนน</th><th scope="col">ความเชื่อมั่น</th><th scope="col">สถานะ</th><th scope="col">ดำเนินการ</th>
            </tr></thead>
            <tbody>{rows.map(o => (
              <tr key={o.id}>
                <td>
                  <h2 className="text-sm font-medium break-words [overflow-wrap:anywhere]">{name(o)}</h2>
                  {o.query && o.page && <p className="mt-1 text-xs text-muted-foreground break-all">{o.page}</p>}
                </td>
                <td className="text-left"><span className="pill">{thaiLabel(o.type)}</span></td>
                <td className="tabular font-semibold">{o.score}<span className="text-xs text-muted-foreground font-normal"> / 100</span></td>
                <td className="tabular">{confidence(o.confidence)}</td>
                <td><span className="pill">{thaiLabel(o.status)}</span></td>
                <td className="min-w-64 text-left"><OpportunityActions {...actions} opportunity={o} onView={() => setSelectedId(o.id)} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <div className="space-y-3 lg:hidden">
        {rows.map(o => (
          <Card key={o.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 text-sm break-words [overflow-wrap:anywhere]">{name(o)}</h2>
              <span className="shrink-0 tabular font-semibold">{o.score}<span className="text-xs font-normal text-muted-foreground"> / 100</span></span>
            </div>
            {o.query && o.page && <p className="mt-2 text-xs text-muted-foreground break-all">{o.page}</p>}
            <div className="my-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="pill">{thaiLabel(o.type)}</span>
              <span className="pill">{thaiLabel(o.status)}</span>
              <span className="text-muted-foreground">ความเชื่อมั่น {confidence(o.confidence)}</span>
            </div>
            <OpportunityActions {...actions} opportunity={o} onView={() => setSelectedId(o.id)} />
          </Card>
        ))}
      </div>
      {selected && (
        <Modal title={name(selected)} close={() => setSelectedId(null)}>
          <div className="mb-5 flex flex-wrap gap-2 text-xs">
            <span className="pill">{thaiLabel(selected.type)}</span>
            <span className="pill">{thaiLabel(selected.status)}</span>
            <span className="pill">คะแนน {selected.score}/100</span>
            <span className="pill">ความเชื่อมั่น {confidence(selected.confidence)}</span>
          </div>
          {selected.query && selected.page && <p className="text-sm break-all mb-4">{selected.page}</p>}
          <p className="text-sm leading-7">{findingText(selected.explanation)}</p>
          <p className="text-sm leading-7 mt-3 mb-5"><strong>ขั้นตอนถัดไป:</strong> {findingText(selected.nextAction)}</p>
          <h3 className="text-sm font-semibold mb-3">ข้อมูลประกอบ</h3>
          <OpportunityEvidence evidence={selected.evidence} />
          <p className="text-xs text-muted-foreground mt-5">ตรวจพบเมื่อ {formatDate(selected.detectedAt, true)}</p>
        </Modal>
      )}
    </>
  );
}
