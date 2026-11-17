import { LoginForm } from "@/components/login-form";
import { Activity, LockKeyhole, ArrowUpRight } from "lucide-react";
import { isConfigured } from "@/lib/config";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default function Login() {
  const ready = isConfigured();
  return (
    <main className="login-shell">
      <div className="login-panel">
        <div className="brand mb-8">
          <span className="brand-mark">
            <Activity size={21} />
          </span>
          SearchPilot
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          พื้นที่ทำงาน SEO ส่วนตัวของคุณ
        </p>
        <h1 className="login-heading">
          เปลี่ยนข้อมูลการค้นหา
          <br />
          เป็นแผนก้าวต่อไป
        </h1>
        <p className="text-sm text-muted-foreground leading-7 mt-3 mb-6">
          เข้าใจการแสดงผล ค้นหาโอกาสปรับปรุง และเดินหน้างาน SEO ของคุณ
        </p>
        <div className="login-form-panel">
          <h2 className="mb-2">ยินดีต้อนรับกลับ</h2>
          <p className="text-xs text-muted-foreground mb-6">
            เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านส่วนตัว
          </p>
          <LoginForm disabled={!ready} />
          {!ready && (
            <Link className="link block mt-4 text-xs" href="/setup">
              ตั้งค่าให้ครบก่อนเริ่มใช้งาน <ArrowUpRight className="inline" size={13} />
            </Link>
          )}
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground leading-5 mt-6">
          <LockKeyhole size={15} className="shrink-0 mt-0.5" />
          เฉพาะเจ้าของเท่านั้น เชื่อมต่อสิทธิ์ Search Console แยกหลังเข้าสู่ระบบ
        </p>
      </div>
    </main>
  );
}
