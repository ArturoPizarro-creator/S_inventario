"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, type Movement, type Product } from "@/lib/api";
import { FileImport } from "@/components/file-import";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, fechaCorta } from "@/lib/utils";

export default function Movimientos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Movement[]>([]);
  const [productId, setProductId] = useState("");
  const [kind, setKind] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [applyStock, setApplyStock] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Product[]>("/products").then(setProducts).catch((e) => toast.error(e.message));
    api<Movement[]>("/movements?limit=30").then(setRecent).catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ stock: number }>("/movements", {
        method: "POST",
        body: JSON.stringify({ product_id: Number(productId), kind, quantity: Number(qty), note }),
      });
      toast.success(`Registrado. Stock actual: ${r.stock} unidades.`);
      setQty("");
      setNote("");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function importHistory(file: File) {
    try {
      const body = new FormData();
      body.append("file", file);
      const r = await api<{ added: number; skipped: number; unknown_skus: string[] }>(`/movements/import?apply_stock=${applyStock}`, {
        method: "POST",
        body,
      });
      const extra = r.unknown_skus.length ? ` SKU no encontrados: ${r.unknown_skus.join(", ")}.` : "";
      toast.success(`Historial cargado: ${r.added} movimientos, ${r.skipped} omitidos.${extra}`);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const kindBtn = (k: "in" | "out", label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setKind(k)}
      aria-pressed={kind === k}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
        kind === k ? "border-primary bg-primary/10 text-foreground" : "bg-card hover:bg-accent",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );

  return (
    <>
      <PageHeader title="Entradas y salidas" description="Registra la mercadería que entra y sale. Las salidas son la demanda con la que aprende el modelo." />

      <section className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Registrar movimiento</CardTitle>
            <CardDescription>Actualiza el stock al instante.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={register} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="m-prod">Producto</Label>
                <Select id="m-prod" value={productId} onChange={(e) => setProductId(e.target.value)} required>
                  <option value="">Elige un producto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name} (stock {p.stock})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-2" role="group" aria-label="Tipo de movimiento">
                {kindBtn("in", "Entrada", ArrowDownToLine)}
                {kindBtn("out", "Salida", ArrowUpFromLine)}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="m-qty">Cantidad</Label>
                  <Input id="m-qty" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="m-note">Nota (opcional)</Label>
                  <Input id="m-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
                </div>
              </div>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                Registrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cargar historial desde Excel</CardTitle>
            <CardDescription>Columnas: sku, fecha, tipo (entrada o salida) y cantidad. Para un buen resultado se necesitan 12 meses o más.</CardDescription>
          </CardHeader>
          <CardContent>
            <FileImport onSubmit={importHistory} label="Cargar historial">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[hsl(350_85%_41%)]" checked={applyStock} onChange={(e) => setApplyStock(e.target.checked)} />
                Aplicar también al stock actual
              </label>
            </FileImport>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Nota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{fechaCorta(m.moved_at)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{m.sku}</span> {m.name}
                    </TableCell>
                    <TableCell>
                      {m.kind === "in" ? (
                        <Badge variant="success">
                          <ArrowDownToLine />
                          Entrada
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <ArrowUpFromLine />
                          Salida
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{m.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
