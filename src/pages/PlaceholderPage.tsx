import { PageHeader } from "../components/PageHeader";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex-1 overflow-auto">
      <PageHeader title={title} description={description} />

      <main className="p-8">
        <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-border">
          <p className="text-sm text-text-muted">Not yet implemented</p>
        </div>
      </main>
    </div>
  );
}
