import type { ReactNode } from "react";

type Theme = "passenger" | "owner" | "advertiser" | "auditor" | "brand";

const themes: Record<Theme, string> = {
  passenger: "from-violet-700 via-fuchsia-700 to-indigo-800",
  advertiser: "from-purple-700 via-pink-700 to-violet-900",
  owner: "from-orange-600 via-amber-600 to-rose-700",
  auditor: "from-emerald-700 via-teal-700 to-cyan-800",
  brand: "from-indigo-800 via-violet-800 to-fuchsia-800",
};

export function AnimatedGradient({
  theme = "brand",
  children,
}: {
  theme?: Theme;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-gradient-to-br ${themes[theme]} animate-bbina-gradient`}
      style={{ backgroundSize: "200% 200%" }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/30 blur-3xl animate-bbina-blob" />
        <div className="absolute top-1/2 -right-32 w-[28rem] h-[28rem] rounded-full bg-cyan-300/30 blur-3xl animate-bbina-blob" style={{ animationDelay: "3s" }} />
        <div className="absolute -bottom-32 left-1/3 w-[26rem] h-[26rem] rounded-full bg-amber-300/30 blur-3xl animate-bbina-blob" style={{ animationDelay: "6s" }} />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}