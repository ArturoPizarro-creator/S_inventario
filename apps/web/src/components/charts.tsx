"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "@/lib/theme";
import { mesCorto } from "@/lib/utils";

const ROJO = "#e0101f";

function palette(dark: boolean) {
  return dark
    ? {
        line: "#e5e5e5",
        axis: { fontSize: 12, fill: "#a3a3a3" },
        grid: "rgba(255,255,255,0.08)",
        inTop: "#d4d4d8",
        inBottom: "#6b6b73",
        cursor: "rgba(255,255,255,0.05)",
        tip: {
          contentStyle: { background: "#161616", border: "1px solid #333", borderRadius: 8, fontSize: 12, color: "#f5f5f5" },
          labelStyle: { color: "#f5f5f5", fontWeight: 700 },
          itemStyle: { color: "#e5e5e5" },
        },
      }
    : {
        line: "#16181f",
        axis: { fontSize: 12, fill: "#4b5160" },
        grid: "rgba(20,24,40,0.1)",
        inTop: "#2a2d38",
        inBottom: "#0f1117",
        cursor: "rgba(20,24,40,0.05)",
        tip: {
          contentStyle: { background: "#fff", border: "1px solid #d8dbe4", borderRadius: 8, fontSize: 12, color: "#12141c", boxShadow: "0 8px 20px -8px rgba(20,24,40,.3)" },
          labelStyle: { color: "#12141c", fontWeight: 700 },
          itemStyle: { color: "#12141c" },
        },
      };
}

export function MovementsChart({ data }: { data: { month: string; in: number; out: number }[] }) {
  const { theme } = useTheme();
  const p = palette(theme === "dark");
  const rows = data.map((d) => ({ mes: mesCorto(d.month), Entradas: d.in, Salidas: d.out }));
  return (
    <ResponsiveContainer width="100%" height={270}>
      <BarChart data={rows} margin={{ left: -10, right: 4, top: 4 }}>
        <defs>
          <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0202f" />
            <stop offset="100%" stopColor="#b30b18" />
          </linearGradient>
          <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.inTop} />
            <stop offset="100%" stopColor={p.inBottom} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={p.grid} />
        <XAxis dataKey="mes" tick={p.axis} tickLine={false} axisLine={false} />
        <YAxis tick={p.axis} tickLine={false} axisLine={false} />
        <Tooltip {...p.tip} cursor={{ fill: p.cursor }} />
        <Legend wrapperStyle={{ fontSize: 12, color: p.axis.fill }} />
        <Bar dataKey="Entradas" fill="url(#gIn)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="Salidas" fill="url(#gOut)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ForecastChart({
  history,
  forecast,
}: {
  history: { month: string; units: number }[];
  forecast: { month: string; units: number }[];
}) {
  const { theme } = useTheme();
  const p = palette(theme === "dark");
  const rows = [
    ...history.map((h, i) => ({
      mes: mesCorto(h.month),
      Historial: h.units,
      // une la línea de predicción con el último dato real
      Predicción: i === history.length - 1 && forecast.length ? h.units : undefined,
    })),
    ...forecast.map((f) => ({ mes: mesCorto(f.month), Historial: undefined, Predicción: f.units })),
  ];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ left: -12, right: 8, top: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={p.grid} />
        <XAxis dataKey="mes" tick={p.axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={p.axis} tickLine={false} axisLine={false} />
        <Tooltip {...p.tip} />
        <Legend wrapperStyle={{ fontSize: 12, color: p.axis.fill }} />
        <Line type="monotone" dataKey="Historial" stroke={p.line} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="Predicción" stroke={ROJO} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
