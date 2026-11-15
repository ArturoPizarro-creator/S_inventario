"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Info } from "lucide-react";
import { api, METHOD_NAMES, type Forecast, type Product } from "@/lib/api";
import { ForecastChart } from "@/components/charts";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { mesCorto } from "@/lib/utils";

function Stat({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${strong ? "border-primary/40 bg-primary/5" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function ForecastSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [fc, setFc] = useState<Forecast | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!product) return;
    setFc(null);
    setError("");
    api<Forecast>(`/forecast/${product.id}?horizon=3`).then(setFc).catch((e) => setError(e.message));
  }, [product]);

  return (
    <Sheet open={!!product} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{product?.name}</SheetTitle>
          <SheetDescription>
            {product?.sku} · stock {product?.stock} · mínimo {product?.min_stock}
          </SheetDescription>
        </SheetHeader>

        {error && (
          <Alert>
            <CircleAlert />
            {error}
          </Alert>
        )}
        {!fc && !error && <Skeleton className="h-64" />}

        {fc && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={fc.method === "xgboost" ? "default" : "secondary"}>{METHOD_NAMES[fc.method]}</Badge>
              <span className="text-muted-foreground">{fc.history_months} meses de historial</span>
            </div>

            {fc.message && (
              <Alert className="border-border bg-muted text-foreground">
                <Info />
                {fc.message}
              </Alert>
            )}

            {fc.history.length > 0 && <ForecastChart history={fc.history} forecast={fc.forecast} />}

            {fc.forecast.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {fc.forecast.map((f) => (
                    <Stat key={f.month} label={mesCorto(f.month)} value={Math.round(f.units)} />
                  ))}
                  {fc.suggested_order !== null && <Stat strong label="Pedido sugerido" value={fc.suggested_order} />}
                </div>

                {fc.metrics && (
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Error del modelo en los últimos {fc.metrics.test_months} meses</p>
                    <p className="mt-1 text-muted-foreground">
                      XGBoost: MAE {fc.metrics.mae} · RMSE {fc.metrics.rmse}. Promedio móvil de 3 meses: MAE {fc.metrics.baseline_mae}.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Menor error es mejor. Pedido sugerido = demanda esperada + stock mínimo − stock actual.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
