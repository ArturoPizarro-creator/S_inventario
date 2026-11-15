import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-PE");

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "2026-03" -> "mar 26" */
export function mesCorto(ym: string) {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1]} ${y.slice(2)}`;
}
