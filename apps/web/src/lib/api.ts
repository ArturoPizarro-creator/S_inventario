export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: isForm ? init.headers : { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    credentials: "same-origin",
  });
  if (res.status === 401 && !path.startsWith("/auth/login") && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Sesión vencida.");
  }
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
};

export type ProductInput = Omit<Product, "id">;

export type Movement = {
  id: number;
  sku: string;
  name: string;
  kind: "in" | "out";
  quantity: number;
  moved_at: string;
  note: string;
};

export type Method = "xgboost" | "promedio_movil_3m" | "sin_datos_suficientes" | "error";

export const METHOD_NAMES: Record<Method, string> = {
  xgboost: "XGBoost",
  promedio_movil_3m: "Promedio móvil 3 m",
  sin_datos_suficientes: "Sin datos suficientes",
  error: "Error al calcular",
};

export type Forecast = {
  product_id: number;
  sku: string;
  name: string;
  stock: number;
  min_stock: number;
  history_months: number;
  history: { month: string; units: number }[];
  method: Method;
  forecast: { month: string; units: number }[];
  metrics: { mae: number; rmse: number; baseline_mae: number; test_months: number } | null;
  suggested_order: number | null;
  message: string | null;
};

export type RestockRow = {
  product_id: number;
  sku: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  method: Method;
  history_months: number;
  expected_demand: number | null;
  suggested_order: number | null;
};

export type Dashboard = {
  products_total: number;
  units_in_stock: number;
  movements_total: number;
  low_stock: { id: number; sku: string; name: string; stock: number; min_stock: number }[];
  monthly: { month: string; in: number; out: number }[];
  top_sellers: { name: string; units: number }[];
};

export type Analysis = {
  available: boolean;
  grafico?: string;
  resumen?: string;
  alertas?: string[];
  sugerencias?: string[];
  confianza?: "alta" | "media" | "baja";
  generado?: string;
  modelo?: string;
  cached?: boolean;
  vigente?: boolean;
  datos?: unknown;
};
