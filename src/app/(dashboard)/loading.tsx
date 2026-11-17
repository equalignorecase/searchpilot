import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
export default function Loading() {
  return (
    <div className="space-y-6">
      <div aria-hidden="true" className="skeleton h-9 w-48 max-w-full" />
      <LoadingSkeleton variant="dashboard" label="กำลังโหลดพื้นที่ทำงาน" />
    </div>
  );
}
