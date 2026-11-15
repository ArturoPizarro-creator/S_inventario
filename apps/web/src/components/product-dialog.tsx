"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, type Product, type ProductInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const empty = { sku: "", name: "", category: "", stock: "0", min_stock: "0" };

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: Product | null; // null = nuevo
  onSaved: () => void;
}) {
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open)
      setF(product ? { sku: product.sku, name: product.name, category: product.category, stock: String(product.stock), min_stock: String(product.min_stock) } : empty);
  }, [open, product]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body: ProductInput = { sku: f.sku.trim(), name: f.name.trim(), category: f.category.trim(), stock: Number(f.stock), min_stock: Number(f.min_stock) };
    try {
      await api(product ? `/products/${product.id}` : "/products", { method: product ? "PUT" : "POST", body: JSON.stringify(body) });
      toast.success(product ? "Producto actualizado." : "Producto creado.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            {product ? "Cambiar el stock aquí lo corrige sin registrar un movimiento." : "Completa los datos del producto."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-sku">SKU</Label>
              <Input id="p-sku" value={f.sku} onChange={set("sku")} required maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-cat">Categoría</Label>
              <Input id="p-cat" value={f.category} onChange={set("category")} maxLength={100} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-name">Nombre</Label>
            <Input id="p-name" value={f.name} onChange={set("name")} required maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-stock">Stock actual</Label>
              <Input id="p-stock" type="number" min={0} value={f.stock} onChange={set("stock")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-min">Stock mínimo</Label>
              <Input id="p-min" type="number" min={0} value={f.min_stock} onChange={set("min_stock")} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
