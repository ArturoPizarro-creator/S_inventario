import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-5xl font-extrabold text-primary">404</h1>
      <p className="text-muted-foreground">Esa página no existe.</p>
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        Volver al panel
      </Link>
    </div>
  );
}
