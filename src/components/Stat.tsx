export function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-4">
      <div className="text-xs uppercase tracking-wider text-white/70">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-white/60">{sub}</div>}
    </div>
  );
}