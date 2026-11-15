"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorView({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto mt-24 flex max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-8 shadow-md text-center">
      <TriangleAlert className="size-10 text-primary" />
      <h2 className="text-xl font-bold">Algo no salió como esperábamos</h2>
      <p className="text-sm text-muted-foreground">
        La pantalla tuvo un problema. Tus datos están a salvo. Vuelve a intentarlo o recarga la página.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcw />
          Reintentar
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Ir al panel
        </Button>
      </div>
    </div>
  );
}
