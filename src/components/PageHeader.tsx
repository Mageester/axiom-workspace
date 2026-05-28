import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="border-b border-border/70 bg-surface-0/35 px-8 py-6 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-hover">
              {eyebrow}
            </p>
          )}
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-text-primary">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
            {description}
          </p>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
