import "server-only";
import { ZodError } from "zod";
import { appOrigin } from "@/lib/config";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== appOrigin())
    throw new HttpError(403, "ที่มาของคำขอไม่ตรงกับ URL แอปที่ตั้งไว้ กรุณาเปิดแอปด้วย URL ที่ถูกต้อง");
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "กรุณาส่งข้อมูลในรูปแบบ application/json");
  const text = await request.text();
  if (Buffer.byteLength(text) > 65536)
    throw new HttpError(413, "ข้อมูลคำขอมีขนาดใหญ่เกินไป");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "ข้อมูล JSON ไม่ถูกต้อง");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      { error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบช่องที่กรอก" },
      { status: 400 },
    );
  // Do not serialize SDK errors: they may contain authorization headers and token responses.
  console.error("SearchPilot request failed", {
    kind: error instanceof Error ? error.name : "UnknownError",
  });
  return Response.json(
    {
      error:
        "ทำรายการไม่สำเร็จ ตรวจสอบการตั้งค่า การเชื่อมต่อ และสถานะการซิงก์",
    },
    { status: 500 },
  );
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
