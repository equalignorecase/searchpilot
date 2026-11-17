# SearchPilot

เว็บวิเคราะห์ข้อมูล Google Search Console สำหรับเจ้าของคนเดียว พัฒนาด้วย Next.js App Router, TypeScript (strict), Tailwind CSS, shadcn/ui primitives, Recharts, TanStack Table, Neon Auth, Prisma 7 (Neon adapter) และ official `googleapis` SDK

หน้าจอภาษาไทย สไตล์ Modern Minimal รองรับ Dark mode และฟอนต์ IBM Plex Sans Thai

---

## การติดตั้งและเริ่มต้นใช้งาน (Quickstart)

### 1. ติดตั้งผ่านตัวช่วยอัตโนมัติ

เปิด Terminal แล้วรันคำสั่ง:

```sh
npm ci
npm run setup
```

ตัวช่วยจะนำทางตั้งค่า Neon Database, Neon Auth, รหัสผ่านเจ้าของระบบ และ Google OAuth สร้างไฟล์ `.env.local` ให้อัตโนมัติ รัน database migration และตรวจสอบความพร้อมผ่าน `npm run check:setup`

### 2. รันแอปพลิเคชัน

เปิด 2 Terminal เพื่อรันเว็บเซิร์ฟเวอร์และตัวประมวลผลงานซิงก์:

```sh
# Terminal 1: Web App (HTTPS บน https://localhost:3000)
npm run dev:https

# Terminal 2: Background Sync Worker (ดึงข้อมูล GSC)
npm run worker
```

> **หมายเหตุ:** คุกกี้เซสชันของ Neon Auth กำหนดแอตทริบิวต์ `Secure` จึงต้องเข้าใช้งานผ่าน `https://localhost:3000` เสมอ (ระบบจะสร้างใบรับรอง SSL จำลองสำหรับ localhost ให้ใน `certificates/`)

---

## การตั้งค่าด้วยตนเอง (Manual Setup)

หากไม่ใช้ตัวช่วย `npm run setup` สามารถตั้งค่าเองได้ตามขั้นตอนดังนี้:

### 1. เตรียม Environment Variables

คัดลอกไฟล์ตัวอย่าง:

```sh
cp .env.example .env.local
```

กำหนดค่าใน `.env.local`:

| ตัวแปร | คำอธิบาย |
| --- | --- |
| `DATABASE_URL` | Neon Postgres pooled connection URL |
| `DATABASE_URL_UNPOOLED` | Neon Postgres direct connection URL (สำหรับ migration) |
| `NEON_AUTH_BASE_URL` | Auth URL ของ Neon project |
| `NEON_AUTH_COOKIE_SECRET` | สร้างด้วย `openssl rand -base64 32` |
| `APP_USERNAME` | ชื่อผู้ใช้สำหรับล็อกอินเข้าสู่ระบบ |
| `OWNER_NEON_USER_ID` | กำหนดอัตโนมัติเมื่อรันคำสั่ง `npm run auth:owner` |
| `GOOGLE_GSC_CLIENT_ID` | OAuth Client ID จาก Google Cloud Console |
| `GOOGLE_GSC_CLIENT_SECRET` | OAuth Client Secret จาก Google Cloud Console |
| `GOOGLE_GSC_REDIRECT_URI` | `https://localhost:3000/api/google/callback` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | คีย์เข้ารหัสโทเคน AES-256 สร้างด้วย `openssl rand -base64 32` |
| `CRON_SECRET` | คีย์ยืนยันสำหรับเรียก `/api/cron` (อย่างน้อย 32 ตัวอักษร) |
| `NEXT_PUBLIC_APP_URL` | Origin ของแอปพลิเคชัน เช่น `https://localhost:3000` |

### 2. เตรียมฐานข้อมูลและบัญชีเจ้าของ

```sh
# สร้างบัญชีเจ้าของใน Neon Auth
npm run auth:owner

# รัน Prisma Client และ Database Migration
npm run db:generate
npm run db:migrate
```

### 3. เชื่อมต่อ Search Console

1. เปิดแอปไปที่เมนู **ตั้งค่า → เชื่อมต่อ Search Console**
2. อนุญาตสิทธิ์อ่านข้อมูล (`webmasters.readonly`) ผ่าน Google OAuth
3. เลือกเว็บไซต์ที่ต้องการวิเคราะห์
4. ไปที่หน้า **ประวัติการซิงก์** เพื่อเริ่มดึงข้อมูลย้อนหลัง (เริ่มต้น 90 วัน)

---

## สถาปัตยกรรมการซิงก์ข้อมูล (Background Sync)

ระบบดึงข้อมูลจาก Google Search Console API 4 ชุดข้อมูล:
- `SITE_DAILY` — ภาพรวมระดับเว็บไซต์รายวัน
- `QUERY_DAILY` — คำค้นหาและสถิติรายวัน
- `PAGE_DAILY` — หน้าเว็บและสถิติรายวัน
- `QUERY_PAGE_DAILY` — ความสัมพันธ์ระหว่างคำค้นหา หน้าเว็บ และสถิติรายวัน

**วิธีการประมวลผลงานซิงก์:**
- **รัน Worker ต่อเนื่อง (แนะนำ):** รัน `npm run worker` ใน background process
- **เรียกผ่าน Cron Endpoint:** ตั้งตัวตั้งเวลาเรียก `GET /api/cron` ทุกนาที พร้อม Header `Authorization: Bearer <CRON_SECRET>`

---

## ฟีเจอร์และการวิเคราะห์ SEO

### รายงานและตารางข้อมูล
- **หน้าคีย์เวิร์ด และ หน้าเว็บ:** ค้นหา กรองตัวเลข เรียงลำดับ แบ่งหน้าฝั่งเซิร์ฟเวอร์ เปรียบเทียบกับช่วงก่อนหน้า และส่งออก CSV สูงสุด 10,000 รายการ
- **วันนี้:** ข้อมูลล่าสุดรายชั่วโมงจาก Google Search Console (`HOURLY_ALL`) อ้างอิงวันและชั่วโมงแปซิฟิก เป็นข้อมูลเบื้องต้นที่อาจล่าช้าหลายชั่วโมงและปรับยอดย้อนหลัง Cache ในฐานข้อมูล 15 นาที ป้องกันคำขอซ้ำข้าม process และหยุดตรวจเมื่อซ่อนแท็บ หาก Google ล้มเหลวจะคงข้อมูลเดิมพร้อมคำเตือน ข้อมูลนี้แยกจากรายงานย้อนหลังและการวิเคราะห์ SEO ไม่ต้องเพิ่ม credentials หรือรัน worker เพื่อดูวันนี้ หลังอัปเดตโค้ดให้รัน `npm run db:migrate`
- **กราฟประสิทธิภาพ:** แสดงแนวโน้มคลิก การแสดงผล CTR และอันดับเฉลี่ย

### โอกาสปรับปรุง SEO (7 เกณฑ์วิเคราะห์)
ระบบวิเคราะห์แนวโน้มจากข้อมูลย้อนหลัง 28 วันโดยคำนวณภายในแอป (ไม่ใช้ AI ภายนอก):
- **โอกาสปรับปรุงเร็ว (Quick Wins):** คีย์เวิร์ดอันดับ 4–15 ที่เพิ่มทราฟฟิกได้รวดเร็ว
- **ใกล้หน้าแรก (Striking Distance):** คีย์เวิร์ดอันดับ 11–20 ที่มีโอกาสดันขึ้นหน้า 1
- **CTR ต่ำ (Low CTR):** อัตราคลิกต่ำกว่าค่ามัธยฐานของอันดับเดียวกันอย่างมีนัยสำคัญ
- **ยอดคลิกลดลง (Click Drop):** คลิกตกลงตั้งแต่ 20% ขึ้นไปจากช่วงก่อนหน้า
- **การแสดงผลเพิ่มขึ้น (Impression Surge):** ยอดแสดงผลโตตั้งแต่ 30% แต่คลิกยังไม่โตตาม
- **หน้าเว็บอาจแข่งขันกันเอง (Cannibalization):** หลาย URL แย่งชิงการแสดงผลในคีย์เวิร์ดเดียวกัน
- **เนื้อหาเสื่อมประสิทธิภาพ (Content Decay):** คลิกลดลงต่อเนื่อง 2 ช่วงเวลาเปรียบเทียบ

### เครื่องมือเสริม
- **SEO Tasks & Change Log:** บันทึกงานปรับปรุง SEO พร้อมเปรียบเทียบสถิติ 28 วันก่อนและหลังปรับปรุง
- **URL Inspection:** ตรวจสอบสถานะการจัดทำดัชนีของ URL จาก Google Search Console

---

## คำสั่งทดสอบและตรวจสอบโค้ด

```sh
# ตรวจสอบ TypeScript Types
npm run typecheck

# ตรวจสอบ Lint
npm run lint

# รัน Unit & Integration Tests (Vitest)
npm run test:unit
npm run test:integration

# รัน End-to-End Tests (Playwright)
npm run test:e2e

# ทดสอบ Production Build
npm run build
```
