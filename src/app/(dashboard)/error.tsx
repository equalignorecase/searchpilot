"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="empty">
      <h1>เปิดพื้นที่ทำงานไม่สำเร็จ</h1>
      <p className="text-muted-foreground">
        ตรวจสอบการเชื่อมต่อ Neon และการตั้งค่าการยืนยันตัวตน แล้วลองอีกครั้ง
      </p>
      <Button onClick={reset}>ลองอีกครั้ง</Button>
    </section>
  );
}
