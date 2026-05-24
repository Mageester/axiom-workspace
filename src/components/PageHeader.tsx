import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="border-b border-border/30 bg-surface-0 px-4 py-7 sm:px-6 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted opacity-80">
              {eyebrow}
            </p>
          )}
          <h2 className="text-2xl font-bold text-text-primary md:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-text-muted">
            {description}
          </p>
        </div>
        {actions && <div className="shrink-0 sm:mb-1">{actions}</div>}
      </div>
    </header>
  );
}
