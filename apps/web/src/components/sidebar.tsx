"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftRight, Bot, ChevronRight, ClipboardCheck, LayoutGrid, LogOut, Menu, Package, User } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Panel de stock", icon: LayoutGrid },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/reposicion", label: "Reposición sugerida", icon: ClipboardCheck },
  { href: "/movimientos", label: "Entradas y salidas", icon: ArrowLeftRight },
  { href: "/asistente", label: "Asistente IA", icon: Bot },
];

export function Logo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo.png" alt="Fargoz Racing" className={cn("h-14 w-auto", className)} />;
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Encabezado negro */}
      <div className="relative overflow-hidden rounded-br-[2.5rem] bg-[#0b0b0e] px-5 pb-5 pt-4 text-white">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-6 h-28 w-24 -skew-x-[28deg] bg-gradient-to-b from-primary to-transparent" />
        <div aria-hidden className="pointer-events-none absolute -right-1 -top-6 h-24 w-6 -skew-x-[28deg] bg-gradient-to-b from-primary/70 to-transparent" />
        <Logo className="relative" />
        <div className="relative mt-4 flex items-center gap-3">
          <div className="relative">
            <div className="flex size-11 items-center justify-center rounded-full border-2 border-primary bg-white/10">
              <User className="size-5" />
            </div>
            <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#0b0b0e] bg-emerald-500" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold">Fargoz Racing</p>
            <p className="text-xs text-neutral-400">Inventario Inteligente</p>
          </div>
        </div>
      </div>

      {/* Menú */}
      <nav aria-label="Principal" className="flex flex-col gap-1.5 px-3 pt-5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-all duration-200",
                active
                  ? "bg-primary font-semibold text-white shadow-md shadow-primary/30"
                  : "text-sidebar-foreground hover:translate-x-0.5 hover:bg-sidebar-accent",
              )}
            >
              <Icon className="size-[18px]" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="size-4" />}
            </Link>
          );
        })}
      </nav>

      {/* Moto (solo si la pantalla es alta) */}
      <div className="relative mt-auto hidden min-h-0 flex-1 items-end overflow-hidden [@media(min-height:800px)]:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/biker.webp" alt="" aria-hidden className="w-full mix-blend-multiply dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/biker-dark.webp" alt="" aria-hidden className="hidden w-full dark:block" />
      </div>

      {/* Pie negro */}
      <div className="relative mt-auto overflow-hidden rounded-tr-[2.5rem] bg-[#0b0b0e] px-5 pb-4 pt-4 text-white [@media(min-height:800px)]:mt-0">
        <div aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-28 -skew-x-[28deg] bg-gradient-to-t from-primary to-transparent" />
        <p className="relative text-sm font-extrabold uppercase italic leading-tight">
          Tu pasión
          <br />
          Nuestra misión <span className="text-primary">//</span>
        </p>
        <button onClick={logout} className="relative mt-3 flex items-center gap-2.5 text-sm text-neutral-200 transition-colors hover:text-white">
          <LogOut className="size-[18px]" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-hidden border-r bg-sidebar lg:block">
        <SidebarBody />
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-[#0b0b0e] px-4 lg:hidden">
        <Button variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menú" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
          <Menu />
        </Button>
        <Logo className="h-9" />
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SheetDescription className="sr-only">Navegación principal</SheetDescription>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
