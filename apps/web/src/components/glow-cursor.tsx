"use client";

import { useEffect, useRef } from "react";

type Props = {
  color?: string; // resplandor
  coreColor?: string; // centro de la línea
  intensity?: number;
  trailWidth?: number;
  linger?: number; // cuánto dura el rastro
  glow?: number;
  clickBurst?: boolean;
  theme?: "dark" | "light";
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

type Pt = { x: number; y: number; t: number };

function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

/**
 * Cursor con rastro luminoso. Sin children cubre toda la pantalla; con children actúa solo sobre su contenedor.
 * Ligero: dibuja únicamente mientras hay rastro, se pausa con la pestaña oculta y se desactiva en pantallas
 * táctiles y cuando el equipo pide reducir el movimiento. Nunca intercepta los clics.
 */
export default function GlowCursor({
  color = "#ff2a3a",
  coreColor = "#ffffff",
  intensity = 1.2,
  trailWidth = 3,
  linger = 1.2,
  glow = 1.1,
  clickBurst = true,
  theme = "light",
  children,
  className,
  style,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isGlobal = !children;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(pointer: coarse)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const wrap = wrapRef.current;
    const target: HTMLElement | Window = isGlobal ? window : (wrap as HTMLElement);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const life = 420 * linger;
    const burstLife = 600;
    const pts: Pt[] = [];
    const bursts: Pt[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;

    const origin = () => (isGlobal || !wrap ? { left: 0, top: 0 } : wrap.getBoundingClientRect());
    const resize = () => {
      const r = isGlobal || !wrap ? { width: innerWidth, height: innerHeight } : wrap.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seg = (a: Pt, b: Pt, width: number, stroke: string) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = width;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    const frame = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      while (pts.length && now - pts[0].t > life) pts.shift();
      for (let i = bursts.length - 1; i >= 0; i--) if (now - bursts[i].t > burstLife) bursts.splice(i, 1);
      ctx.globalCompositeOperation = theme === "dark" ? "lighter" : "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const k = 1 - (now - b.t) / life;
        if (k <= 0) continue;
        const e = k * k;
        seg(a, b, trailWidth * (2.2 + glow * 3) * e, rgba(color, 0.1 * intensity * glow * e)); // halo
        seg(a, b, trailWidth * (1.3 + glow) * e, rgba(color, 0.35 * intensity * e)); // aura
        seg(a, b, trailWidth * 0.55 * e + 0.4, rgba(coreColor, 0.95 * e)); // núcleo
      }

      const head = pts[pts.length - 1];
      if (head) {
        const k = 1 - (now - head.t) / life;
        if (k > 0) {
          const r = trailWidth * (3 + glow * 3);
          const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r);
          g.addColorStop(0, rgba(coreColor, 0.9 * k));
          g.addColorStop(0.35, rgba(color, 0.55 * intensity * k));
          g.addColorStop(1, rgba(color, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const b of bursts) {
        const p = (now - b.t) / burstLife;
        const r = 6 + 54 * (1 - Math.pow(1 - p, 3));
        ctx.lineWidth = 2.5 * (1 - p) + 0.5;
        ctx.strokeStyle = rgba(color, (1 - p) * 0.9 * Math.min(1.2, intensity));
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(coreColor, (1 - p) * 0.8);
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        for (let s = 0; s < 8; s++) {
          const ang = (s / 8) * Math.PI * 2 + 0.3;
          const from = r * 0.7;
          const to = r * (1.05 + 0.25 * p);
          ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(ang) * from, b.y + Math.sin(ang) * from);
          ctx.lineTo(b.x + Math.cos(ang) * to, b.y + Math.sin(ang) * to);
          ctx.lineWidth = 1.6 * (1 - p);
          ctx.strokeStyle = rgba(color, (1 - p) * 0.9);
          ctx.stroke();
        }
      }

      if (pts.length || bursts.length) raf = requestAnimationFrame(frame);
      else {
        raf = 0;
        ctx.clearRect(0, 0, w, h);
      }
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: Event) => {
      const m = e as MouseEvent;
      const o = origin();
      const x = m.clientX - o.left;
      const y = m.clientY - o.top;
      const last = pts[pts.length - 1];
      if (last && Math.hypot(x - last.x, y - last.y) < 2) return;
      pts.push({ x, y, t: performance.now() });
      if (pts.length > 70) pts.shift();
      start();
    };
    const onDown = (e: Event) => {
      if (!clickBurst) return;
      const m = e as MouseEvent;
      const o = origin();
      bursts.push({ x: m.clientX - o.left, y: m.clientY - o.top, t: performance.now() });
      start();
    };
    const onVisibility = () => {
      if (document.hidden) {
        pts.length = 0;
        bursts.length = 0;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    target.addEventListener("mousemove", onMove, { passive: true });
    target.addEventListener("mousedown", onDown, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      target.removeEventListener("mousemove", onMove);
      target.removeEventListener("mousedown", onDown);
    };
  }, [color, coreColor, intensity, trailWidth, linger, glow, clickBurst, theme, isGlobal]);

  const canvas = (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={
        isGlobal
          ? { position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 9999 }
          : { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }
      }
    />
  );
  if (isGlobal) return canvas;
  return (
    <div ref={wrapRef} className={className} style={{ position: "relative", ...style }}>
      {children}
      {canvas}
    </div>
  );
}
