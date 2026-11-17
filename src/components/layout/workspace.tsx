"use client";
import Link from "next/link";
import { todayRange } from "@/lib/locale";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  Activity,
  LayoutDashboard,
  Search,
  Files,
  Lightbulb,
  ListChecks,
  ScanSearch,
  History,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Globe,
  LockKeyhole,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthButton } from "@/components/auth-button";
export type Site = {
  id: string;
  siteUrl: string;
  displayName: string;
  permission: string;
  isDefault: boolean;
  propertyType: string;
  lastSyncAt: string | null;
};
type WorkspaceState = {
  sites: Site[];
  site: Site | undefined;
  siteId: string;
  start: string;
  end: string;
  loading: boolean;
  refresh: () => void;
  query: string;
  version: number;
};
const Context = createContext<WorkspaceState | null>(null);
export function useWorkspace() {
  const c = useContext(Context);
  if (!c) throw new Error("Workspace is missing");
  return c;
}
function sessionExpired() {
  window.location.replace(new URL("/login", window.location.origin).href);
}
export async function api<T = unknown>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(
    "/api/" + path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (response.status === 401) {
    sessionExpired();
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data as T;
}
export function useResource<T>(path: string | null) {
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    error: string;
  }>({ path: null, data: null, error: "" });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    fetch("/api/" + path, { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        if (r.status === 401) {
          sessionExpired();
          throw new Error("เซสชันหมดอายุ");
        }
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "โหลดข้อมูลไม่สำเร็จ");
        return data as T;
      })
      .then((data) => {
        if (!controller.signal.aborted) setState({ path, data, error: "" });
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setState({ path, data: null, error: e.message });
      });
    return () => controller.abort();
  }, [path]);
  return {
    data: state.path === path ? state.data : null,
    error: state.path === path ? state.error : "",
    loading: !!path && state.path !== path,
  };
}

const navigation = [
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/keywords", label: "คีย์เวิร์ด", icon: Search },
  { href: "/pages", label: "หน้าเว็บ", icon: Files },
  { href: "/opportunities", label: "โอกาสปรับปรุง", icon: Lightbulb },
  { href: "/tasks", label: "งาน SEO", icon: ListChecks },
  { href: "/inspections", label: "ตรวจสอบ URL", icon: ScanSearch },
  { href: "/sync", label: "ประวัติการซิงก์", icon: History },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
];
export function Workspace({
  children,
  username,
  initialRange,
}: {
  children: ReactNode;
  username: string;
  initialRange: { start: string; end: string };
}) {
  const path = usePathname(),
    [sites, setSites] = useState<Site[]>([]),
    [siteId, setSiteId] = useState(""),
    [start, setStart] = useState(initialRange.start),
    [end, setEnd] = useState(initialRange.end),
    [draft, setDraft] = useState(initialRange),
    [preset, setPreset] = useState("28"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [menu, setMenu] = useState(false);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const mode = localStorage.getItem("searchpilot-theme");
    const value = mode
      ? mode === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", value);
  }, []);
  useEffect(() => {
    let active = true;
    api<Site[]>("sites")
      .then((data) => {
        if (!active) return;
        setSites(data);
        setSiteId((current) =>
          data.some((s) => s.id === current)
            ? current
            : data.find(
                (s) => s.id === localStorage.getItem("searchpilot-site"),
              )?.id ||
              data.find((s) => s.isDefault)?.id ||
              data[0]?.id ||
              "",
        );
        setLoading(false);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [version]);
  const site = sites.find((s) => s.id === siteId),
    query = new URLSearchParams({
      siteId,
      start,
      end,
      v: String(version),
    }).toString();
  function choosePreset(value: string) {
    setPreset(value);
    if (value === "custom") return;
    if (value === "today") {
      const range = todayRange();
      setStart(range.start);
      setEnd(range.end);
      setDraft(range);
      return;
    }
    const last = new Date(initialRange.end + "T00:00:00Z"),
      first = new Date(last);
    first.setUTCDate(last.getUTCDate() - Number(value) + 1);
    const range = {
      start: first.toISOString().slice(0, 10),
      end: initialRange.end,
    };
    setStart(range.start);
    setEnd(range.end);
    setDraft(range);
  }
  return (
    <Context.Provider
      value={{
        sites,
        site,
        siteId,
        start,
        end,
        loading,
        refresh,
        query,
        version,
      }}
    >
      <a href="#main-content" className="screen-reader focus:static focus:p-3">
        ข้ามไปยังเนื้อหา
      </a>
      {menu && (
        <button
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Link href="/dashboard" className="brand px-5 py-6 no-underline">
          <span className="brand-mark">
            <Activity size={21} />
          </span>
          SearchPilot
        </Link>
        <div className="px-5 mt-3 mb-3 text-xs text-muted-foreground font-medium">
          พื้นที่ทำงาน
        </div>
        <nav className="px-3 flex-1">
          {navigation.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenu(false)}
              className={"nav-item " + (path === n.href ? "active" : "")}
              aria-current={path === n.href ? "page" : undefined}
            >
              <n.icon />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-5 border-t border-border">
          <div className="flex items-center gap-2 text-xs font-medium">
            <LockKeyhole size={14} className="text-primary" />
            พื้นที่ทำงานส่วนตัว
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 leading-5">
            ข้อมูลของคุณ เพื่อก้าวต่อไปที่ชัดเจน
            <br />
            ข้อมูลจาก Search Console
          </p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Button
            className="mobile-menu"
            size="icon"
            variant="ghost"
            aria-label="เปิดเมนู"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={20} /> : <Menu size={20} />}
          </Button>
          <Globe size={18} className="text-muted-foreground hidden sm:block" />
          <label className="min-w-0 max-w-60">
            <span className="sr-only">เว็บไซต์ใน Search Console</span>
            <select
              aria-label="เว็บไซต์ใน Search Console"
              className="max-w-full text-xs border-0 font-medium"
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                localStorage.setItem("searchpilot-site", e.target.value);
              }}
            >
              <option value="" disabled>
                {loading ? "กำลังโหลดเว็บไซต์…" : "เลือกเว็บไซต์"}
              </option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </label>
          <div className="date-controls">
            <label>
              <span className="sr-only">ช่วงวันที่</span>
              <select
                aria-label="ช่วงวันที่"
                value={preset}
                onChange={(e) => choosePreset(e.target.value)}
                className="text-xs py-2"
              >
                <option value="today">วันนี้</option>
                <option value="7">7 วันล่าสุด</option>
                <option value="28">28 วันล่าสุด</option>
                <option value="90">90 วันล่าสุด</option>
                <option value="custom">กำหนดช่วงเวลาเอง</option>
              </select>
            </label>
            {preset === "custom" && (
              <form
                className="flex gap-2 items-center flex-wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.start > draft.end) {
                    setError("วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด");
                    return;
                  }
                  setStart(draft.start);
                  setEnd(draft.end);
                  setError("");
                }}
              >
                <Input
                  type="date"
                  aria-label="วันที่เริ่มต้น"
                  required
                  value={draft.start}
                  max={draft.end}
                  onChange={(e) =>
                    setDraft({ ...draft, start: e.target.value })
                  }
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="date"
                  aria-label="วันที่สิ้นสุด"
                  required
                  value={draft.end}
                  min={draft.start}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
                <Button size="sm" variant="outline">
                  นำไปใช้
                </Button>
              </form>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="สลับธีมสี"
            onClick={() => {
              const value =
                !document.documentElement.classList.contains("dark");
              document.documentElement.classList.toggle("dark", value);
              localStorage.setItem(
                "searchpilot-theme",
                value ? "dark" : "light",
              );
            }}
          >
            <Sun size={17} className="hidden dark:block" />
            <Moon size={17} className="dark:hidden" />
          </Button>
          <details className="relative">
            <summary
              className="list-none cursor-pointer flex items-center gap-2"
              aria-label="เมนูบัญชี"
            >
              <span className="size-8 rounded-full bg-muted grid place-items-center font-semibold text-primary">
                {username[0]?.toUpperCase()}
              </span>
              <ChevronDown size={12} />
            </summary>
            <div className="absolute right-0 mt-3 p-4 z-50 border border-border rounded-xl bg-card shadow-lg min-w-56">
              <p className="text-xs mb-3">{username}</p>
              <AuthButton />
            </div>
          </details>
        </header>
        <main id="main-content" className="content">
          {error && (
            <div role="alert" className="error mb-5">
              {error}
            </div>
          )}
          {children}
        </main>
        <footer className="content !py-5 text-[11px] text-muted-foreground border-t border-border flex justify-between gap-4">
          <span>SearchPilot · วิเคราะห์ SEO ส่วนตัว</span>
          <span>เขตเวลารายงาน: America/Los_Angeles (เวลาแปซิฟิก)</span>
        </footer>
      </div>
    </Context.Provider>
  );
}
