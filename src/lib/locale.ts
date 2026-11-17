const labels: Record<string, string> = {
  ACTIVE: "เชื่อมต่อแล้ว", REVOKED: "ถูกเพิกถอน", RECONNECT_REQUIRED: "ต้องเชื่อมต่อใหม่", EXPIRED: "หมดอายุ",
  ALL: "ทั้งหมด", OPEN: "เปิดอยู่", DISMISSED: "ละเว้น", RESOLVED: "แก้ไขแล้ว",
  TODO: "รอดำเนินการ", IN_PROGRESS: "กำลังดำเนินการ", DONE: "เสร็จแล้ว",
  LOW: "ต่ำ", MEDIUM: "ปานกลาง", HIGH: "สูง", CRITICAL: "เร่งด่วน",
  QUEUED: "อยู่ในคิว", RUNNING: "กำลังทำงาน", RETRY: "รอลองใหม่", FAILED: "ล้มเหลว", SUCCEEDED: "สำเร็จ",
  BACKFILL: "ดึงข้อมูลย้อนหลัง", DAILY: "อัปเดตรายวัน", MANUAL: "ซิงก์ตามช่วงที่เลือก",
  QUICK_WIN: "โอกาสปรับปรุงเร็ว", LOW_CTR: "CTR ต่ำ", NEAR_FIRST_PAGE: "ใกล้หน้าแรก",
  TRAFFIC_DROP: "ยอดคลิกลดลง", IMPRESSION_GROWTH: "การแสดงผลเพิ่มขึ้น",
  POTENTIAL_CANNIBALIZATION: "หน้าเว็บอาจแข่งขันกันเอง", CONTENT_DECAY: "เนื้อหาเสื่อมประสิทธิภาพ",
  Product: "สินค้า", Category: "หมวดหมู่", Blog: "บทความ", "Landing Page": "หน้าเป้าหมาย", Other: "อื่น ๆ",
  siteOwner: "เจ้าของเว็บไซต์", siteFullUser: "ผู้ใช้สิทธิ์เต็ม", siteRestrictedUser: "ผู้ใช้สิทธิ์จำกัด", siteUnverifiedUser: "ยังไม่ยืนยันสิทธิ์",
  PASS: "ผ่าน", FAIL: "ไม่ผ่าน", NEUTRAL: "ยังไม่มีข้อสรุป", PARTIAL: "ผ่านบางส่วน", UNKNOWN: "ไม่ทราบ", VERDICT_UNSPECIFIED: "ไม่ระบุผล",
  clicks: "คลิก", impressions: "การแสดงผล", ctr: "CTR", position: "อันดับเฉลี่ย",
  range: "ช่วงอันดับ", peerCount: "จำนวนรายการเปรียบเทียบ", peerMedianCtr: "CTR มัธยฐานของกลุ่ม",
  previousClicks: "คลิกช่วงก่อนหน้า", olderClicks: "คลิกช่วงก่อนช่วงฐาน", decline: "สัดส่วนที่ลดลง",
  previousImpressions: "การแสดงผลช่วงก่อนหน้า", urls: "URL ที่เกี่ยวข้อง", preferredUrl: "URL หลัก",
  "Submitted and indexed": "ส่ง URL และจัดทำดัชนีแล้ว", "Crawled - currently not indexed": "รวบรวมข้อมูลแล้ว แต่ยังไม่จัดทำดัชนี",
  "Discovered - currently not indexed": "ค้นพบแล้ว แต่ยังไม่จัดทำดัชนี", "URL is unknown to Google": "Google ยังไม่รู้จัก URL นี้",
};
export const thaiLabel = (value: string) => Object.hasOwn(labels, value) ? labels[value] : value;

export function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short", timeZone: "Asia/Bangkok" } : { timeZone: "UTC" }),
  }).format(date);
}

const findings: Record<string, string> = {
  "Meaningful visibility close to the leading search results.": "มีการแสดงผลมากและอันดับใกล้ผลการค้นหาลำดับต้น ๆ",
  "Review intent, title relevance, content coverage and internal links.": "ตรวจเจตนาการค้นหา ความเกี่ยวข้องของชื่อหน้า ความครบถ้วนของเนื้อหา และลิงก์ภายใน",
  "Average position is near the first page; individual rankings vary.": "อันดับเฉลี่ยใกล้หน้าแรก แต่อันดับของการค้นหาแต่ละครั้งอาจต่างกัน",
  "Compare the landing page against the query’s intent.": "เปรียบเทียบหน้าเว็บปลายทางกับเจตนาของคำค้นหา",
  "CTR trails this property’s peers in the same three-position band. Device and brand mix may differ.": "CTR ต่ำกว่ากลุ่มเปรียบเทียบของเว็บไซต์นี้ในช่วงอันดับเดียวกัน แต่อุปกรณ์และแบรนด์อาจต่างกัน",
  "Review the search snippet and intent; segment in GSC before editing.": "ตรวจข้อความที่แสดงในผลค้นหาและเจตนาการค้นหา แยกกลุ่มข้อมูลใน GSC ก่อนแก้ไข",
  "Clicks declined against an equivalent previous period.": "จำนวนคลิกลดลงเมื่อเทียบกับช่วงก่อนหน้าที่มีจำนวนวันเท่ากัน",
  "No row was returned in the current period. Observed clicks declined; Google can omit rows, so verify in GSC.": "ไม่มีแถวข้อมูลในช่วงปัจจุบัน จำนวนคลิกที่สังเกตได้ลดลง แต่ Google อาจละเว้นบางแถว ควรตรวจยืนยันใน GSC",
  "Check seasonality, indexing, demand and competing pages.": "ตรวจผลตามฤดูกาล การจัดทำดัชนี ความต้องการค้นหา และหน้าเว็บคู่แข่ง",
  "Impressions grew without a comparable improvement in clicks.": "การแสดงผลเพิ่มขึ้น แต่จำนวนคลิกไม่ได้เพิ่มขึ้นในสัดส่วนใกล้เคียงกัน",
  "Check new queries, intent and snippet alignment.": "ตรวจคำค้นหาใหม่ เจตนาการค้นหา และความสอดคล้องของข้อความในผลค้นหา",
  "Clicks fell across three equal periods; this is an observed trend.": "จำนวนคลิกลดลงต่อเนื่องใน 3 ช่วงที่มีจำนวนวันเท่ากัน เป็นแนวโน้มที่สังเกตได้จากข้อมูล",
  "Review freshness, seasonality, competitors and indexing before updating.": "ตรวจความสดใหม่ของเนื้อหา ฤดูกาล คู่แข่ง และการจัดทำดัชนีก่อนปรับปรุง",
  "Multiple visible URLs suggest potential overlap. This does not establish harmful cannibalization.": "หลาย URL มีการแสดงผลและอาจทับซ้อนกัน แต่ยังยืนยันไม่ได้ว่าเป็นการแข่งขันกันเองที่ส่งผลเสีย",
  "Compare search intent and URL trends; check the preferred landing page before consolidating.": "เปรียบเทียบเจตนาการค้นหาและแนวโน้มแต่ละ URL ตรวจหน้าเว็บหลักก่อนรวมเนื้อหา",
};
export const findingText = (value: string) => Object.hasOwn(findings, value) ? findings[value] : value;

export function pacificDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function todayRange(now = new Date()) {
  const day = pacificDate(now);
  return { start: day, end: day };
}
