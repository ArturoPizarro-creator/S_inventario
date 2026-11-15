"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, CircleAlert, Loader2, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const HINTS = [
  "¿Qué productos tienen stock bajo?",
  "¿Cuáles fueron los más vendidos este mes?",
  "¿Cuánto debería pedir del casco integral?",
];

function Avatar({ role }: { role: Msg["role"] }) {
  const Icon = role === "user" ? User : Bot;
  return (
    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", role === "user" ? "bg-foreground/10 text-foreground" : "bg-primary text-primary-foreground")}>
      <Icon className="size-4" />
    </div>
  );
}

export default function Asistente() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const [slow, setSlow] = useState(false);
  const [status, setStatus] = useState<{ provider: string; model: string; configured: boolean } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setText(q);
  }, []);

  useEffect(() => {
    api<{ provider: string; model: string; configured: boolean }>("/assistant/status").then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  // si la respuesta tarda, se avisa en pantalla
  useEffect(() => {
    setSlow(false);
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), 12_000);
    return () => clearTimeout(t);
  }, [busy]);

  async function send(message: string) {
    const clean = message.trim();
    if (!clean || busy) return;
    setText("");
    const history = msgs;
    setMsgs([...history, { role: "user", content: clean }]);
    setBusy(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 100_000); // no esperar para siempre
    try {
      const r = await api<{ reply: string }>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message: clean, history }),
        signal: ctrl.signal,
      });
      setMsgs((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      toast.error(aborted ? "El modelo tardó demasiado en responder. Inténtalo de nuevo en un momento." : (e as Error).message);
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Asistente de inventario" description="Pregunta por el stock, las ventas o la demanda esperada. Responde con los datos reales del sistema.">
        {status && (
          <Badge variant="outline" title="Modelo de lenguaje en uso">
            <Bot />
            {status.model}
          </Badge>
        )}
      </PageHeader>

      {status && !status.configured && (
        <Alert className="mb-4">
          <CircleAlert />
          <span>
            El asistente aún no tiene clave de API. Agrega <code>{status.provider === "claude" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY"}</code> al archivo <code>.env</code> y reinicia la API.
          </span>
        </Alert>
      )}

      <Card className="flex flex-col">
        <div className="flex max-h-[58vh] min-h-[340px] flex-col gap-4 overflow-y-auto p-5" aria-live="polite">
          {msgs.length === 0 && (
            <div className="m-auto max-w-md space-y-3 text-center">
              <Sparkles className="mx-auto size-6 text-primary" />
              <p className="text-sm text-muted-foreground">Escribe una pregunta o elige una de las sugerencias.</p>
              <div className="flex flex-col gap-2">
                {HINTS.map((h) => (
                  <Button key={h} variant="outline" size="sm" onClick={() => send(h)} disabled={busy}>
                    {h}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <Avatar role={m.role} />
              <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-3">
              <Avatar role="assistant" />
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {slow ? "Está tardando más de lo normal (el servicio gratuito de Google puede estar saturado). Sigo intentando…" : "Consultando el inventario…"}
              </div>
            </div>
          )}
          <div ref={end} />
        </div>

        <form
          className="flex gap-2 border-t p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: ¿Cuántos cascos quedan?" aria-label="Tu pregunta" maxLength={2000} />
          <Button type="submit" disabled={busy || !text.trim()}>
            <Send />
            Preguntar
          </Button>
        </form>
      </Card>
    </>
  );
}
