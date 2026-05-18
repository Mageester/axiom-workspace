interface StatCardProps {
  label: string;
  value: string | number;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}
