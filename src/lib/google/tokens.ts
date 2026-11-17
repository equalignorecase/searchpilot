export function selectRefreshToken(
  next: string | null | undefined,
  previous: { token: string; subject: string | null } | null,
  subject: string | null,
) {
  if (next) return next;
  if (previous && subject && previous.subject === subject)
    return previous.token;
  throw new Error(
    "Google ไม่ได้ให้สิทธิ์สำหรับการเข้าถึงเบื้องหลัง กรุณาเชื่อมต่อใหม่พร้อมขอความยินยอม",
  );
}
