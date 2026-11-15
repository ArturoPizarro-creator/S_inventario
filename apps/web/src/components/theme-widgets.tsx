"use client";

import { Toaster } from "sonner";
import GlowCursor from "@/components/glow-cursor";
import { useTheme } from "@/lib/theme";

export function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} richColors position="bottom-right" />;
}

export function ThemedCursor() {
  const { theme } = useTheme();
  return <GlowCursor color="#ff2a3a" intensity={1.7} trailWidth={3.5} linger={1.3} glow={1.4} clickBurst theme={theme} />;
}
