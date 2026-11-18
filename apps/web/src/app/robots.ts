import type { MetadataRoute } from "next";

// Sistema interno: se pide a los buscadores que no indexen nada.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
