import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="px-8 py-10 border-b border-border/30 bg-surface-0">
      <div className="max-w-7xl mx-auto flex items-end justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted opacity-80">
              {eyebrow}
            </p>
          )}
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium text-text-muted leading-relaxed">
            {description}
          </p>
        </div>
        {actions && <div className="shrink-0 mb-1">{actions}</div>}
      </div>
    </header>
  );
}
