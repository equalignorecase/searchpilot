import Link from "next/link";
import {
  Activity,
  Database,
  KeyRound,
  Link2,
  ArrowRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { isConfigured } from "@/lib/config";
export const dynamic = "force-dynamic";
export default function Setup() {
  const ready = isConfigured();
  const steps = [
    {
      icon: Database,
      title: "สร้างฐานข้อมูล Neon ของคุณ",
      text: "ใช้การเชื่อมต่อแบบ pooled สำหรับ DATABASE_URL และแบบตรงสำหรับ DATABASE_URL_UNPOOLED รัน npm run db:migrate ใน branch สำหรับพัฒนาก่อน",
      ready: !!process.env.DATABASE_URL,
    },
    {
      icon: KeyRound,
      title: "สร้างบัญชีเจ้าของส่วนตัว",
      text: "เปิดการเข้าสู่ระบบด้วยอีเมลและรหัสผ่านใน Neon Auth ตั้งค่า APP_USERNAME แล้วรัน npm run auth:owner เพื่อสร้างและผูกบัญชีเจ้าของ ไม่จำเป็นต้องใช้อีเมล Google ส่วนตัวเพื่อเข้าแอป",
      ready: !!(
        process.env.NEON_AUTH_BASE_URL &&
        process.env.NEON_AUTH_COOKIE_SECRET &&
        process.env.APP_USERNAME &&
        process.env.OWNER_NEON_USER_ID
      ),
    },
    {
      icon: Link2,
      title: "ตั้งค่าสิทธิ์ Search Console",
      text: "สร้าง Google OAuth client สำหรับเว็บแยกต่างหาก โดยขอสิทธิ์อ่าน Search Console เท่านั้น ตั้งค่า client, redirect URI และคีย์เข้ารหัสโทเคนขนาด 32 ไบต์",
      ready: !!(
        process.env.GOOGLE_GSC_CLIENT_ID &&
        process.env.GOOGLE_GSC_CLIENT_SECRET &&
        process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
      ),
    },
  ];
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="brand mb-12">
        <span className="brand-mark">
          <Activity size={21} />
        </span>
        SearchPilot <span className="pill ml-auto">ตั้งค่าเริ่มต้น</span>
      </div>
      <h1>เริ่มวิเคราะห์ข้อมูลการค้นหาที่นี่</h1>
      <p className="text-muted-foreground leading-7 mt-4 max-w-xl">
        เชื่อมต่อระบบส่วนตัว สร้างบัญชีเจ้าของ แล้วรวมประวัติ Search Console จากข้อมูลจริงไว้ในพื้นที่ทำงานเดียว
      </p>
      <div className="space-y-4 mt-10">
        {steps.map((s, i) => (
          <section
            key={s.title}
            className="rounded-xl border border-border bg-card p-6 flex gap-5"
          >
            <s.icon size={23} className="text-primary shrink-0" />
            <div className="flex-1">
              <div className="flex gap-3 justify-between">
                <h2>
                  {i + 1}. {s.title}
                </h2>
                {s.ready ? (
                  <CheckCircle2 size={18} className="text-primary" />
                ) : (
                  <Circle size={18} className="text-muted-foreground" />
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-6 mt-3">
                {s.text}
              </p>
            </div>
          </section>
        ))}
      </div>
      <div className="notice mt-6">
        ตัวบอกสถานะตรวจเพียงว่ามีค่าตั้งอยู่ ไม่ได้ยืนยันการเชื่อมต่อ ดู README.md สำหรับข้อมูลรับรอง การย้ายโครงสร้างฐานข้อมูล การรันตัวประมวลผลงาน และการตรวจระบบจริง ขั้นตอนตั้งค่าไม่สร้างสถิติการค้นหาจำลอง
      </div>
      <div className="flex items-center justify-between mt-8">
        <span className="text-xs text-muted-foreground">
          ออกแบบเพื่อใช้งานส่วนตัว · อ่านข้อมูล Google เท่านั้น
        </span>
        <Link
          href={ready ? "/login" : "https://console.neon.tech"}
          className="link flex items-center gap-2"
        >
          {ready ? "ไปหน้าเข้าสู่ระบบ" : "เปิด Neon Console"}
          <ArrowRight size={16} />
        </Link>
      </div>
    </main>
  );
}
