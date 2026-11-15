"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Eye, EyeOff, Loader2, LogIn, Lock, User } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/sidebar";

function Field({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="chamfer-sm bg-red-600/80 p-px transition-colors focus-within:bg-red-400">
      <div className="chamfer-sm flex items-stretch bg-[#0c0c10]">
        <span className="flex w-12 items-center justify-center border-r border-red-600/40 bg-black/50 text-white">
          <Icon className="size-5" />
        </span>
        {children}
      </div>
    </div>
  );
}

const inputCls = "h-12 w-full bg-transparent px-4 text-[15px] text-white placeholder:text-neutral-400 focus:outline-none";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [hint, setHint] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ username, password, remember }) });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#09090c] p-4 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_400px_at_50%_100%,rgba(220,20,40,0.28),transparent_70%)]" />
      {/* arte del diseño (en pantallas anchas) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/login-left.webp" alt="" aria-hidden className="pointer-events-none absolute left-0 top-0 hidden h-full w-auto max-w-[48vw] object-cover object-left md:block" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/login-right.webp" alt="" aria-hidden className="pointer-events-none absolute bottom-0 right-0 hidden h-[89%] w-auto max-w-[30vw] object-cover object-right md:block" />
      <p className="absolute right-6 top-6 hidden text-lg font-semibold italic lg:block">
        Rendimiento · Control · Resultados
        <span className="mt-1 block h-0.5 w-3/4 bg-gradient-to-r from-transparent to-red-600" />
      </p>

      <div className="relative z-10 w-full max-w-[460px] pt-14">
        <Logo className="mx-auto mb-4 h-14 md:hidden" />
        {/* marco con esquinas cortadas y brillo rojo */}
        <div className="relative [filter:drop-shadow(0_0_14px_rgba(255,30,50,0.65))]">
          <div className="chamfer-lg bg-gradient-to-b from-red-500 to-red-700 p-[2px]">
            <div className="chamfer-lg-inner bg-[linear-gradient(160deg,#16161b,#0a0a0d)] px-8 pb-6 pt-16">
              <h1 className="text-center text-xl font-bold leading-tight">
                Bienvenido a
                <span className="block text-3xl font-extrabold uppercase italic tracking-tight">
                  Fargoz <span className="text-red-600">Racing</span>
                </span>
              </h1>
              <p className="mt-3 flex items-center gap-3 text-center text-sm italic text-neutral-200">
                <span className="h-px flex-1 bg-red-600" />
                Inicia sesión para continuar
                <span className="h-px flex-1 bg-red-600" />
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <Field icon={User}>
                  <label htmlFor="user" className="sr-only">Usuario</label>
                  <input id="user" className={inputCls} placeholder="Usuario" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
                </Field>
                <Field icon={Lock}>
                  <label htmlFor="pass" className="sr-only">Contraseña</label>
                  <input id="pass" className={inputCls} placeholder="Contraseña" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} className="px-3 text-neutral-300 hover:text-white">
                    {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </Field>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-red-600" />
                    Recordarme
                  </label>
                  <button type="button" onClick={() => setHint((v) => !v)} className="text-neutral-200 underline underline-offset-2 hover:text-white">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {hint && (
                  <p className="rounded-md border border-neutral-700 bg-white/5 p-3 text-xs leading-relaxed text-neutral-200">
                    Este sistema no envía correos. Para cambiar la contraseña, el administrador edita <code>ADMIN_PASSWORD</code> en el archivo <code>.env</code> y reinicia la API.
                  </p>
                )}
                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-md border border-red-500/60 bg-red-600/15 p-3 text-sm text-red-200">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="chamfer-sm flex h-12 w-full items-center justify-center gap-3 bg-gradient-to-b from-red-500 to-red-700 text-base font-bold shadow-[0_0_24px_rgba(255,30,50,0.45)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
                >
                  {busy ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
                  Iniciar Sesión
                </button>
              </form>

              <div className="mt-5 flex items-center gap-3 text-neutral-300">
                <span className="h-px flex-1 bg-neutral-700" />
                <svg aria-hidden viewBox="0 0 16 16" className="size-5"><path fill="currentColor" d="M0 0h4v4H0zM8 0h4v4H8zM4 4h4v4H4zM12 4h4v4h-4zM0 8h4v4H0zM8 8h4v4H8zM4 12h4v4H4zM12 12h4v4h-4z" /></svg>
                <span className="h-px flex-1 bg-neutral-700" />
              </div>
              <p className="mt-2 text-center text-sm italic text-neutral-300">Acelera tu productividad</p>
            </div>
          </div>
          {/* emblema */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/emblem.png" alt="" aria-hidden className="absolute -top-12 left-1/2 size-28 -translate-x-1/2" />
        </div>
      </div>
    </div>
  );
}
