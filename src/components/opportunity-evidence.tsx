import { thaiLabel } from "@/lib/locale";
function evidenceValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("th-TH", {
      style: ["ctr", "peerMedianCtr", "decline"].includes(key) ? "percent" : "decimal",
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (Array.isArray(value)) return value.length ? value.map(item => evidenceValue(key, item)).join("\n") : "—";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  return typeof value === "string" ? value : JSON.stringify(value);
}
export function OpportunityEvidence({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence);
  if (!entries.length) return <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลประกอบ</p>;
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <caption className="sr-only">ข้อมูลประกอบโอกาสปรับปรุง</caption>
          <thead><tr><th scope="col">ตัวชี้วัด</th><th scope="col">ค่า</th></tr></thead>
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key}>
                <th scope="row" className="w-1/3 align-top whitespace-normal">{thaiLabel(key)}</th>
                <td className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{evidenceValue(key, value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer">ข้อมูลดิบ (JSON)</summary>
        <pre className="mt-3">{JSON.stringify(evidence, null, 2)}</pre>
      </details>
    </>
  );
}
