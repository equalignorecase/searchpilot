export type LoadingVariant = "dashboard" | "table" | "list" | "chart";
export function LoadingSkeleton({
  variant = "list",
  label = "กำลังโหลดข้อมูล",
}: {
  variant?: LoadingVariant;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-4">
        {variant === "dashboard" && (
          <div className="kpi-grid">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-8 w-1/2" />
                <div className="skeleton h-3 w-3/4" />
              </div>
            ))}
          </div>
        )}
        {(variant === "chart" || variant === "dashboard") && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="skeleton h-4 w-1/3 mb-6" />
            <div className="chart-wrap flex items-end gap-3 border-b border-border pb-3">
              {[40, 55, 45, 70, 60, 80, 65, 90].map((height, key) => (
                <div key={key} className="skeleton flex-1" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        )}
        {variant === "table" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-6 border-b border-border p-5">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-3 w-16" />
            </div>
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <div key={key} className="grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-5 border-b border-border last:border-0 px-5 py-4">
                <div className="skeleton h-3 w-4/5" />
                <div className="skeleton h-3" />
                <div className="skeleton h-3" />
                <div className="skeleton h-3" />
              </div>
            ))}
          </div>
        )}
        {variant === "list" && [0, 1, 2].map((key) => (
          <div key={key} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex justify-between gap-6">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-5 w-16" />
            </div>
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
