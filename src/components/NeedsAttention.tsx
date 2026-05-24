import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { AttentionItem, AttentionSeverity } from "../types/workspace";

interface NeedsAttentionProps {
  items: AttentionItem[];
  onAction?: (item: AttentionItem) => void;
}

function SeverityIcon({ severity }: { severity: AttentionSeverity }) {
  switch (severity) {
    case "critical":
      return <AlertCircle size={14} className="text-status-locked shrink-0" />;
    case "warning":
      return <AlertTriangle size={14} className="text-status-dirty shrink-0" />;
    case "info":
      return <Info size={14} className="text-text-muted shrink-0" />;
  }
}

function severityBorder(severity: AttentionSeverity): string {
  switch (severity) {
    case "critical": return "border-status-locked/20";
    case "warning": return "border-status-dirty/15";
    case "info": return "border-border/15";
  }
}

export function NeedsAttention({ items, onAction }: NeedsAttentionProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.slice(0, 5).map(item => (
        <div
          key={item.id}
          className={`flex flex-col gap-3 p-3 rounded-xl bg-surface-2/20 border ${severityBorder(item.severity)} transition-colors hover:bg-surface-2/30 sm:flex-row sm:items-start`}
        >
          <div className="mt-0.5">
            <SeverityIcon severity={item.severity} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-text-primary">{item.title}</p>
            <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{item.description}</p>
          </div>
          {item.actionLabel && onAction && (
            <button
              className="w-fit shrink-0 text-[10px] font-bold text-accent hover:text-accent-hover transition-colors mt-0.5"
              onClick={() => onAction(item)}
            >
              {item.actionLabel}
            </button>
          )}
        </div>
      ))}
      {items.length > 5 && (
        <p className="text-[10px] text-text-muted text-center py-1">
          +{items.length - 5} more items
        </p>
      )}
    </div>
  );
}
