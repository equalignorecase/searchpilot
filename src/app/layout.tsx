import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const plex = localFont({
  src: [
    { path: "./fonts/IBMPlexSansThai-Regular.woff", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSansThai-Medium.woff", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSansThai-SemiBold.woff", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexSansThai-Bold.woff", weight: "700", style: "normal" },
  ],
  variable: "--font-plex",
  display: "swap",
  fallback: ["Tahoma", "Arial", "sans-serif"],
});
export const metadata: Metadata = {
  title: {
    default: "SearchPilot — วิเคราะห์ข้อมูล SEO",
    template: "%s · SearchPilot",
  },
  description: "พื้นที่ทำงานส่วนตัวสำหรับวิเคราะห์ข้อมูล Google Search Console",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={plex.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
