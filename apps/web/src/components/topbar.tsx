"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, User } from "lucide-react";
import { api, type Dashboard } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, close]);
  return ref;
}

export function Topbar() {
  const router = useRouter();
  const path = usePathname();
  const [low, setLow] = useState<Dashboard["low_stock"]>([]);
  const [user, setUser] = useState("");
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const bellRef = useOutside(bell, () => setBell(false));
  const menuRef = useOutside(menu, () => setMenu(false));

  useEffect(() => {
    api<Dashboard>("/dashboard").then((d) => setLow(d.low_stock)).catch(() => {});
  }, [path]);
  useEffect(() => {
    api<{ user: string }>("/auth/me").then((r) => setUser(r.user)).catch(() => {});
  }, []);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mb-4 flex flex-col items-end gap-1">
    <div className="flex items-center gap-3">
      <ThemeToggle />
      <div ref={bellRef} className="relative">
        <button
          onClick={() => setBell((v) => !v)}
          aria-label={`Alertas de stock: ${low.length}`}
          aria-expanded={bell}
          className="relative flex size-10 items-center justify-center rounded-full border bg-card shadow-sm transition-colors hover:bg-accent"
        >
          <Bell className="size-[18px]" />
          {low.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {low.length}
            </span>
          )}
        </button>
        {bell && (
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-md border bg-card p-3 shadow-xl">
            <p className="mb-2 text-sm font-semibold">Stock bajo</p>
            {low.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todo en orden.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {low.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="tabular-nums text-primary">
                      {p.stock}/{p.min_stock}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/reposicion" onClick={() => setBell(false)} className="mt-3 block text-sm font-medium text-primary hover:underline">
              Ver reposición sugerida
            </Link>
          </div>
        )}
      </div>

      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenu((v) => !v)}
          aria-expanded={menu}
          aria-label="Menú de usuario"
          className="flex h-10 items-center gap-1.5 rounded-full border bg-card pl-1.5 pr-3 shadow-sm transition-colors hover:bg-accent"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-foreground/10">
            <User className="size-4" />
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
        {menu && (
          <div className="absolute right-0 z-40 mt-2 w-48 rounded-md border bg-card p-1 shadow-xl">
            <p className="px-3 py-2 text-xs text-muted-foreground">Sesión de {user || "usuario"}</p>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent">
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
    <p className="hidden text-right text-xs leading-tight sm:block">
      <span className="block font-bold">Fargoz Racing</span>
      <span className="text-muted-foreground">
        Siempre en movimiento <span className="font-bold italic text-primary">//</span>
      </span>
    </p>
    </div>
  );
}
