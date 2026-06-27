import type { ReactNode } from "react";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl text-white ${className}`}
    >
      {children}
    </div>
  );
}