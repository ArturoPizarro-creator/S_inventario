"use client";

import { useCallback, useEffect, useState } from "react";
import { LineChart, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, type Product } from "@/lib/api";
import { FileImport } from "@/components/file-import";
import { ForecastSheet } from "@/components/forecast-sheet";
import { PageHeader } from "@/components/page-header";
import { ProductDialog } from "@/components/product-dialog";
import { StockBadge } from "@/components/stock-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Productos() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [forecastFor, setForecastFor] = useState<Product | null>(null);

  const load = useCallback(() => {
    api<Product[]>(`/products?q=${encodeURIComponent(q)}`).then(setItems).catch((e) => toast.error(e.message));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(p: Product) {
    if (!window.confirm(`¿Eliminar "${p.name}" y todo su historial de movimientos? No se puede deshacer.`)) return;
    try {
      await api(`/products/${p.id}`, { method: "DELETE" });
      toast.success("Producto eliminado.");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function importFile(file: File) {
    try {
      const body = new FormData();
      body.append("file", file);
      const r = await api<{ created: number; updated: number }>("/products/import", { method: "POST", body });
      toast.success(`${r.created} productos nuevos y ${r.updated} actualizados.`);
      setImportOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Productos" description="Consulta el stock y la demanda esperada de cada producto.">
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload />
          Importar Excel
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus />
          Nuevo producto
        </Button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nombre o SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar producto" />
      </div>

      <Card>
        {items && items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No hay productos. Crea uno o importa un Excel con las columnas sku, nombre, categoria, stock y stock_minimo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.category}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.stock}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.min_stock}</TableCell>
                  <TableCell>
                    <StockBadge stock={p.stock} min={p.min_stock} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Ver predicción" aria-label={`Ver predicción de ${p.name}`} onClick={() => setForecastFor(p)}>
                        <LineChart />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        aria-label={`Editar ${p.name}`}
                        onClick={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" title="Eliminar" aria-label={`Eliminar ${p.name}`} onClick={() => remove(p)}>
                        <Trash2 className="text-primary" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ProductDialog open={formOpen} onOpenChange={setFormOpen} product={editing} onSaved={load} />
      <ForecastSheet product={forecastFor} onClose={() => setForecastFor(null)} />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar productos</DialogTitle>
            <DialogDescription>
              Columnas: sku y nombre (obligatorias), categoria, stock y stock_minimo. Si el SKU ya existe, se actualiza.
            </DialogDescription>
          </DialogHeader>
          <FileImport onSubmit={importFile} label="Importar productos" />
        </DialogContent>
      </Dialog>
    </>
  );
}
