import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function StockBadge({ stock, min }: { stock: number; min: number }) {
  if (stock === 0) return <Badge variant="destructive"><TriangleAlert />Agotado</Badge>;
  if (stock <= min) return <Badge variant="destructive"><TriangleAlert />Bajo</Badge>;
  return <Badge variant="success">Normal</Badge>;
}
