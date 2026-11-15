"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Selector de archivo .xlsx/.csv con botón de envío. */
export function FileImport({
  onSubmit,
  label = "Importar",
  children,
}: {
  onSubmit: (file: File) => Promise<void>;
  label?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!file) return;
    setBusy(true);
    try {
      await onSubmit(file);
      setFile(null);
      if (ref.current) ref.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input ref={ref} type="file" accept=".xlsx,.csv" className="sr-only" id="file-import" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <label
        htmlFor="file-import"
        className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input bg-muted/40 p-4 text-sm transition-colors hover:bg-muted"
      >
        <FileSpreadsheet className="size-5 text-muted-foreground" />
        <span className={file ? "font-medium" : "text-muted-foreground"}>{file ? file.name : "Elige un archivo .xlsx o .csv"}</span>
      </label>
      {children}
      <Button onClick={go} disabled={!file || busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}
        {label}
      </Button>
    </div>
  );
}
