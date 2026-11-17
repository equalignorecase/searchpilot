import Link from "next/link";
export default function NotFound() {
  return (
    <main className="min-h-screen grid place-content-center gap-4 p-6 text-center">
      <p className="text-muted-foreground">404</p>
      <h1>ไม่พบหน้าที่ต้องการ</h1>
      <p className="text-muted-foreground">หน้านี้อาจถูกย้าย หรือ URL ไม่ถูกต้อง</p>
      <Link className="link" href="/dashboard">กลับหน้าภาพรวม</Link>
    </main>
  );
}
