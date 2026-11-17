import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { isConfigured } from "@/lib/config";
export default function proxy(request: NextRequest) {
  if (!isConfigured())
    return NextResponse.redirect(new URL("/setup", request.url));
  return auth().middleware({ loginUrl: "/login" })(request);
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/keywords/:path*",
    "/pages/:path*",
    "/opportunities/:path*",
    "/tasks/:path*",
    "/inspections/:path*",
    "/sync/:path*",
    "/settings/:path*",
  ],
};
