import { Plane, Ship, BadgeCheck } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />

      {/* decoración: arte del diseño (detrás del contenido) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/light-top.webp" alt="" aria-hidden className="pointer-events-none fixed left-64 right-0 top-0 z-0 hidden h-[88px] object-cover object-left lg:block dark:!hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/light-bottom.webp" alt="" aria-hidden className="pointer-events-none fixed bottom-0 left-64 right-0 z-0 hidden h-14 object-cover lg:block dark:!hidden" />
      <div aria-hidden className="pointer-events-none fixed left-60 top-0 z-0 hidden h-24 w-56 overflow-hidden dark:lg:block">
        <div className="absolute -top-4 left-10 h-36 w-12 -skew-x-[28deg] bg-gradient-to-b from-primary to-transparent" />
        <div className="absolute -top-4 left-24 h-36 w-5 -skew-x-[28deg] bg-gradient-to-b from-neutral-900 to-transparent" />
        <div className="absolute -top-4 left-32 h-36 w-3 -skew-x-[28deg] bg-gradient-to-b from-primary/70 to-transparent" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/right.webp" alt="" aria-hidden className="pointer-events-none fixed right-0 top-[96px] z-0 hidden w-48 min-[1500px]:block dark:!hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/right-dark.webp" alt="" aria-hidden className="pointer-events-none fixed right-0 top-[96px] z-0 hidden w-48 dark:min-[1500px]:block" />
      <div aria-hidden className="pointer-events-none fixed bottom-0 right-0 z-0 hidden w-44 min-[1500px]:block">
        <div className="absolute inset-0 bg-[#0b0b0e] [clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)]" />
        <div className="absolute -left-2 inset-y-0 w-4 -skew-x-[28deg] bg-primary" />
        <ul className="relative space-y-2 py-4 pl-14 pr-3 text-xs text-white">
          <li className="flex items-center gap-2"><Plane className="size-4" />Importación</li>
          <li className="flex items-center gap-2"><Ship className="size-4" />Exportación</li>
          <li className="flex items-center gap-2"><BadgeCheck className="size-4" />Control Inteligente</li>
        </ul>
      </div>

      <main className="relative z-10 lg:pl-64 min-[1500px]:pr-48">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-8 sm:py-6">
          <Topbar />
          {children}
        </div>
      </main>
    </>
  );
}
