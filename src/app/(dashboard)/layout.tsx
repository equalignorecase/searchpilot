import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/owner-guard";
import { HttpError } from "@/lib/security/http";
import { isConfigured } from "@/lib/config";
import { defaultRange } from "@/features/analytics/math";
import { Workspace } from "@/components/layout/workspace";
import { AuthButton } from "@/components/auth-button";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isConfigured()) redirect("/setup");
  try {
    await requireOwner();
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login");
    if (e instanceof HttpError && e.status === 403)
      return (
        <main className="p-12 max-w-lg mx-auto">
          <h1>สำหรับเจ้าของเท่านั้น</h1>
          <p className="my-5 text-muted-foreground">
            บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้ SearchPilot
          </p>
          <AuthButton />
        </main>
      );
    throw e;
  }
  return (
    <Workspace
      username={process.env.APP_USERNAME!}
      initialRange={defaultRange()}
    >
      {children}
    </Workspace>
  );
}
