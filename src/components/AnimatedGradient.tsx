import type { ReactNode } from "react";

type Theme = "passenger" | "owner" | "advertiser" | "auditor" | "brand" | "auth";

const themes: Record<Theme, string> = {
  passenger: "from-emerald-600 via-teal-600 to-cyan-800",
  advertiser: "from-emerald-600 via-teal-600 to-cyan-800",
  owner: "from-emerald-600 via-teal-600 to-cyan-800",
  auditor: "from-emerald-600 via-teal-600 to-cyan-800",
  brand: "from-indigo-800 via-violet-800 to-fuchsia-800",
  // A muted green used only on the login/signup pages — distinct from the
  // dashboards' teal but deliberately not bright.
  auth: "from-green-800 via-emerald-700 to-teal-800",
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
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-300/40 blur-3xl animate-bbina-blob" />
        <div
          className="absolute top-1/2 -right-32 w-[28rem] h-[28rem] rounded-full bg-teal-300/40 blur-3xl animate-bbina-blob"
          style={{ animationDelay: "3s" }}
        />
        <div
          className="absolute -bottom-32 left-1/3 w-[26rem] h-[26rem] rounded-full bg-cyan-300/30 blur-3xl animate-bbina-blob"
          style={{ animationDelay: "6s" }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
