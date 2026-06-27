import type { ReactNode } from "react";

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warn" | "danger" }) {
  const tones: Record<string, string> = {
    default: "bg-white/15 text-white",
    success: "bg-emerald-500/30 text-emerald-100 border border-emerald-300/40",
    warn: "bg-amber-500/30 text-amber-100 border border-amber-300/40",
    danger: "bg-rose-500/30 text-rose-100 border border-rose-300/40",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}