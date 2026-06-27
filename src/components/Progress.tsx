export function Progress({ value, color = "bg-white" }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}