"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { api, METHOD_NAMES, type RestockRow } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Reposicion() {
  const [horizon, setHorizon] = useState(3);
  const [rows, setRows] = useState<RestockRow[] | null>(null);

  useEffect(() => {
    setRows(null);
    api<RestockRow[]>(`/forecast/restock/all?horizon=${horizon}`).then(setRows).catch((e) => toast.error(e.message));
  }, [horizon]);

  function exportCsv() {
    if (!rows) return;
    const head = "sku,producto,stock,stock_minimo,demanda_esperada,pedido_sugerido,metodo";
    const lines = rows.map((r) =>
      [r.sku, `"${r.name.replace(/"/g, '""')}"`, r.stock, r.min_stock, r.expected_demand ?? "", r.suggested_order ?? "", r.method].join(","),
    );
    const blob = new Blob(["\uFEFF" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reposicion-${horizon}m.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeader title="Reposición sugerida" description="Cuánto pedir de cada producto según la demanda que predice el modelo.">
        <div className="w-44">
          <Select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} aria-label="Meses a cubrir">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                Cubrir {n} {n === 1 ? "mes" : "meses"}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!rows?.length}>
          <Download />
          Exportar CSV
        </Button>
      </PageHeader>

      <Card>
        {!rows ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No hay productos registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Demanda esperada</TableHead>
                <TableHead className="text-right">Pedir</TableHead>
                <TableHead>Método</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.product_id}>
                  <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.stock}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.min_stock}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.expected_demand !== null ? Math.round(r.expected_demand) : "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.suggested_order === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : r.suggested_order > 0 ? (
                      <Badge>{r.suggested_order}</Badge>
                    ) : (
                      <Badge variant="success">0</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.method === "error" ? "destructive" : r.method === "xgboost" ? "outline" : "secondary"}>
                      {r.method === "sin_datos_suficientes" ? `Faltan datos (${r.history_months} m)` : METHOD_NAMES[r.method]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
