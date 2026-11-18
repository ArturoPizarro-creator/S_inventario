const API = process.env.API_INTERNAL_URL || "http://localhost:8000";

// Cabeceras de seguridad para todas las páginas.
// La política de contenido (CSP) solo permite cargar recursos de este mismo sitio.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js inserta pequeños scripts propios para arrancar la página
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // nadie puede incrustar esta página en otra (clickjacking)
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" }, // lo mismo que frame-ancestors, para navegadores antiguos
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }, // solo aplica con HTTPS
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }, // sistema interno: que los buscadores no lo indexen
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false, // no anunciar la tecnología del servidor
  images: { unoptimized: true }, // no se usa el optimizador de imágenes (menos superficie de ataque)
  // Margen para consultas largas (predicciones, asistente): evita cortar a los 30 s por defecto.
  experimental: { proxyTimeout: 120_000 },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // El navegador llama a /api/... y Next lo reenvía al backend de Python.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/:path*` }];
  },
};

export default nextConfig;
