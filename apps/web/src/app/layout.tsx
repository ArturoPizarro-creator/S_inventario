import type { Metadata } from "next";
import { ThemedCursor, ThemedToaster } from "@/components/theme-widgets";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fargoz Racing · Inventario inteligente",
  description: "Control de stock, predicción de demanda y asistente conversacional.",
  robots: { index: false, follow: false },
  other: { "darkreader-lock": "true" }, // evita que extensiones oscurezcan la página sin avisar
};

// Aplica el tema guardado antes de pintar, para que no parpadee.
const themeScript = `try{if(localStorage.getItem("fargoz-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <ThemedToaster />
        <ThemedCursor />
      </body>
    </html>
  );
}
