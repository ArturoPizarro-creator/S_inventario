const API = process.env.API_INTERNAL_URL || "http://localhost:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Margen para consultas largas (predicciones, asistente): evita cortar a los 30 s por defecto.
  experimental: { proxyTimeout: 120_000 },
  // El navegador llama a /api/... y Next lo reenvía al backend de Python.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/:path*` }];
  },
};

export default nextConfig;
