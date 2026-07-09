import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/25 bg-white/10 text-white shadow-2xl shadow-black/30 [backdrop-filter:blur(24px)_saturate(180%)] ${className}`}
    >
      <div className="pointer-events-none absolute -left-1/5 -top-1/2 h-[140%] w-[140%] bg-gradient-to-br from-white/15 via-transparent to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}
