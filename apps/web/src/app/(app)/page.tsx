"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Box, ChartColumn, CircleAlert, ClipboardCheck, Boxes, Package, Trophy, TrendingUp, TriangleAlert } from "lucide-react";
import { AiAnalysis } from "@/components/ai-analysis";
import { KpiIcon } from "@/components/kpi-icon";
import { api, type Dashboard } from "@/lib/api";
import { MovementsChart } from "@/components/charts";
import { StockBadge } from "@/components/stock-badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function Kpi({
  label,
  value,
  icon,
  bare,
  side: Side,
  sideRed,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  bare?: boolean;
  side?: React.ElementType;
  sideRed?: boolean;
}) {
  return (
    <Card className="transition-shadow duration-200 hover:shadow-[0_12px_26px_-10px_rgba(200,16,40,0.35)]">
      <CardContent className="flex items-center gap-4 p-4">
        <KpiIcon icon={icon} bare={bare} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{label}</p>
          <p className="text-3xl font-extrabold leading-tight tabular-nums">{value.toLocaleString("es-PE")}</p>
        </div>
        {Side && <Side className={sideRed ? "size-7 text-primary" : "size-6 text-muted-foreground"} />}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon: Icon, children, iconClass }: { icon: React.ElementType; children: React.ReactNode; iconClass?: string }) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-lg">
      <Icon className={iconClass ?? "size-5 text-primary"} />
      {children}
    </CardTitle>
  );
}

export default function Panel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <Alert>
        <CircleAlert />
        {error}
      </Alert>
    );

  const maxTop = data ? Math.max(1, ...data.top_sellers.map((t) => t.units)) : 1;

  return (
    <>
      <h1 className="sr-only">Panel de stock</h1>

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Productos con stock bajo" value={data.low_stock.length} icon={Package} side={TriangleAlert} sideRed />
            <Kpi label="Productos registrados" value={data.products_total} icon={ClipboardCheck} side={Box} />
            <Kpi label="Unidades en stock" value={data.units_in_stock} icon={Boxes} />
            <Kpi bare label="Movimientos registrados" value={data.movements_total} icon={TrendingUp} side={ArrowLeftRight} />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="relative lg:col-span-2">
              <span aria-hidden className="absolute inset-y-4 left-0 w-1 bg-primary" />
              <CardHeader>
                <SectionTitle icon={ChartColumn}>Entradas y salidas por mes</SectionTitle>
                <CardDescription>Últimos 12 meses, en unidades.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.monthly.every((m) => m.in === 0 && m.out === 0) ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Aún no hay movimientos en este periodo.</p>
                ) : (
                  <MovementsChart data={data.monthly} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionTitle icon={Trophy} iconClass="size-5 text-primary">
                  Más vendidos
                </SectionTitle>
                <CardDescription>Salidas de los últimos 30 días.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.top_sellers.length === 0 && <p className="text-sm text-muted-foreground">Sin salidas en los últimos 30 días.</p>}
                {data.top_sellers.map((t) => (
                  <div key={t.name} className="space-y-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{t.name}</span>
                      <span className="font-semibold tabular-nums">{t.units}</span>
                    </div>
                    <Progress value={(t.units / maxTop) * 100} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <AiAnalysis />

          <Card>
            <CardHeader>
              <SectionTitle icon={Package}>Productos en o por debajo de su stock mínimo</SectionTitle>
            </CardHeader>
            <CardContent>
              {data.low_stock.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún producto está en o por debajo de su stock mínimo.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="w-44">Nivel</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.low_stock.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.stock}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.min_stock}</TableCell>
                        <TableCell>
                          <Progress danger value={p.min_stock ? (p.stock / p.min_stock) * 100 : 0} />
                        </TableCell>
                        <TableCell>
                          <StockBadge stock={p.stock} min={p.min_stock} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
