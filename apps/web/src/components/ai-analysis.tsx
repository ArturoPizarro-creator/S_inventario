"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChartColumn, Check, ChevronDown, ChevronUp, Copy, ListChecks, Loader2, MessageCircle, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { api, type Analysis } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CONF = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" } as const;
const KEY = "fargoz-ia-abierto";

function cuando(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? `hoy ${hora}` : `${d.toLocaleDateString("es-PE")} ${hora}`;
}

function textoParaCopiar(a: Analysis) {
  const d = a.generado ? new Date(a.generado) : new Date();
  const fecha = `${d.toLocaleDateString("es-PE")} a las ${d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;
  const lista = (t: string, v?: string[]) => (v?.length ? `\n${t}\n${v.map((x) => `- ${x}`).join("\n")}\n` : "");
  return [
    "ANÁLISIS DE INVENTARIO · Fargoz Racing",
    `Generado por IA el ${fecha} con ${a.modelo}. Verificar antes de decidir.`,
    a.vigente === false ? "ATENCIÓN: los datos cambiaron después de este análisis; puede estar desactualizado." : "",
    a.grafico ? `\nQUÉ MUESTRA EL GRÁFICO\n${a.grafico}` : "",
    a.resumen ? `\nRESUMEN\n${a.resumen}` : "",
    lista("ALERTAS", a.alertas),
    lista("SUGERENCIAS DIRECTAS", a.sugerencias),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const ta = document.createElement("textarea"); // respaldo para navegadores sin portapapeles
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export function AiAnalysis() {
  const [data, setData] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const persist = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {}
  };

  // Al abrir el panel solo se recupera el último análisis (no se consulta al modelo).
  useEffect(() => {
    api<Analysis>("/dashboard/analysis").then((a) => a.available && setData(a)).catch(() => {});
    try {
      setOpen(localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);

  async function run(refresh: boolean) {
    setBusy(true);
    try {
      setData(await api<Analysis>(`/dashboard/analysis?refresh=${refresh}`, { method: "POST" }));
      persist(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!data) return;
    await copiar(textoParaCopiar(data));
    setCopied(true);
    toast.success("Resumen copiado, con la fecha y el aviso de que lo generó una IA.");
    setTimeout(() => setCopied(false), 2000);
  }

  // Sin análisis todavía: tarjeta con el botón
  if (!data) {
    return (
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2.5 text-lg">
              <Sparkles className="size-5 text-primary" />
              Análisis con IA
            </CardTitle>
            <CardDescription>Explica el gráfico en palabras simples y te da sugerencias directas. Las cifras salen de tu sistema.</CardDescription>
          </div>
          <Button onClick={() => run(false)} disabled={busy} className="shrink-0">
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Analizando…" : "Analizar con IA"}
          </Button>
        </CardHeader>
      </Card>
    );
  }

  const vigente = data.vigente !== false;

  return (
    <Card>
      {/* Barra compacta: siempre visible */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-5 text-primary" />
          Análisis con IA
        </h2>
        <Badge variant="outline">
          <Sparkles />
          Generado por IA
        </Badge>
        {vigente ? (
          <Badge variant="success">
            <Check />
            Al día
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <TriangleAlert />
            Desactualizado
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">{cuando(data.generado)}</span>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => persist(!open)} aria-expanded={open}>
            {open ? <ChevronUp /> : <ChevronDown />}
            {open ? "Ocultar" : "Ver"}
          </Button>
          <Button variant="outline" size="sm" onClick={onCopy}>
            {copied ? <Check /> : <Copy />}
            Copiar resumen
          </Button>
          <Button variant={vigente ? "outline" : "default"} size="sm" onClick={() => run(true)} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {busy ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>
      </div>

      {open && !busy && (
        <CardContent className="space-y-5 border-t pt-4">
          {!vigente && (
            <div role="status" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Los datos cambiaron desde que se generó este análisis. Pulsa <strong className="mx-1">Actualizar</strong> antes de usarlo o compartirlo.
            </div>
          )}

          <div className={cn("space-y-5", !vigente && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2">
              {data.confianza && <Badge variant={data.confianza === "alta" ? "success" : "secondary"}>{CONF[data.confianza]}</Badge>}
              <span className="text-xs text-muted-foreground">
                Generado con {data.modelo} · {data.generado ? new Date(data.generado).toLocaleString("es-PE") : ""}
              </span>
            </div>

            {data.grafico && (
              <div className="rounded-lg border-l-4 border-primary bg-muted/60 p-4">
                <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                  <ChartColumn className="size-4 text-primary" />
                  Qué muestra el gráfico
                </h3>
                <p className="text-sm leading-relaxed">{data.grafico}</p>
              </div>
            )}
            {data.resumen && <p className="text-sm leading-relaxed">{data.resumen}</p>}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <TriangleAlert className="size-4 text-primary" />
                  Alertas
                </h3>
                {data.alertas?.length ? (
                  <ul className="list-disc space-y-1.5 pl-5 text-sm">
                    {data.alertas.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin alertas.</p>
                )}
              </div>
              <div className="rounded-lg border border-primary/30 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="size-4 text-primary" />
                  Sugerencias directas
                </h3>
                {data.sugerencias?.length ? (
                  <ul className="list-disc space-y-1.5 pl-5 text-sm">
                    {data.sugerencias.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin sugerencias.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-xs text-muted-foreground">
              Sugerencias generadas por IA a partir de los datos del panel. Verifícalas antes de decidir una compra.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/asistente?q=Explícame con más detalle el análisis del panel y qué debería pedir primero">
                <MessageCircle />
                Preguntar más
              </Link>
            </Button>
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium">Ver los datos que usó la IA</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-snug">{JSON.stringify(data.datos, null, 2)}</pre>
          </details>
        </CardContent>
      )}

      {open && busy && (
        <CardContent className="border-t pt-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Actualizando el análisis…
          </p>
        </CardContent>
      )}
    </Card>
  );
}
