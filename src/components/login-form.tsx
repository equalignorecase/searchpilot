"use client";
import { useState } from "react";
import { LogIn } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setPending(true);
        setError("");
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: form.get("username"),
              password: form.get("password"),
            }),
          });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
          }
          const sessionResponse = await fetch("/api/auth/get-session", {
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });
          if (!sessionResponse.ok)
            throw new Error("ตรวจสอบเซสชันไม่สำเร็จ กรุณาลองอีกครั้ง");
          const session = await sessionResponse.json();
          if (!session?.user || !session?.session)
            throw new Error("เบราว์เซอร์ไม่ได้เก็บคุกกี้เซสชัน กรุณาใช้ HTTPS ตาม URL ที่ตั้งไว้และอนุญาตคุกกี้");
          // Reload server components with the new session instead of racing router refresh.
          window.location.replace("/dashboard");
        } catch (e) {
          setError(e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
            ? "เข้าสู่ระบบใช้เวลานานเกินไป กรุณาลองอีกครั้ง"
            : e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        ชื่อผู้ใช้
        <Input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          required
          disabled={disabled || pending}
        />
      </label>
      <label>
        รหัสผ่าน
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          disabled={disabled || pending}
        />
      </label>
      <Button className="w-full" disabled={disabled || pending}>
        <LogIn size={16} />
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
