"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
export function AuthButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function signOut() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("ออกจากระบบไม่สำเร็จ");
      router.replace("/login");
      router.refresh();
    } catch {
      setError("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
      setPending(false);
    }
  }
  return (
    <div>
      <Button variant="ghost" disabled={pending} onClick={signOut}>
        <LogOut size={16} />
        {pending ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
