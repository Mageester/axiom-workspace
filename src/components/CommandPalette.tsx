import { useCallback, useEffect, useRef, useState } from "react";
import { Command, Search } from "lucide-react";
import type { CommandItem } from "../types/workspace";

interface CommandPaletteProps {
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? commands.filter(cmd => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords?.some(k => k.toLowerCase().includes(q))
        );
      })
    : commands;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeSelected = useCallback(() => {
    const cmd = filtered[selectedIndex];
    if (cmd) {
      onClose();
      cmd.action();
    }
  }, [filtered, selectedIndex, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        executeSelected();
      }
    },
    [filtered.length, executeSelected, onClose],
  );

  if (!open) return null;

  const categoryOrder = ["work", "project", "navigation", "system"] as const;
  const grouped = categoryOrder
    .map(cat => ({
      category: cat,
      items: filtered.filter(c => c.category === cat),
    }))
    .filter(g => g.items.length > 0);

  const categoryLabels: Record<string, string> = {
    work: "Work",
    project: "Projects",
    navigation: "Navigation",
    system: "System",
  };

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[16vh] bg-black/65 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border/45 bg-surface-1/95 shadow-2xl overflow-hidden animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/20">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Open project, start work, clone, refresh..."
            className="flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="shrink-0 rounded-md border border-border/40 bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
            ESC
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-3">
          {grouped.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-semibold text-text-primary">No command found</p>
              <p className="mt-1 text-xs text-text-muted">Try a project name, “start”, “clone”, or “sync”.</p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.category}>
                <div className="px-5 py-1.5 text-[10px] font-bold text-text-muted">
                  {categoryLabels[group.category]}
                </div>
                {group.items.map(cmd => {
                  const thisIndex = flatIndex++;
                  const isSelected = thisIndex === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                        isSelected ? "bg-accent/12 text-text-primary" : "text-text-secondary hover:bg-surface-2/50"
                      }`}
                      onClick={() => {
                        onClose();
                        cmd.action();
                      }}
                      onMouseEnter={() => setSelectedIndex(thisIndex)}
                    >
                      <Command size={14} className={isSelected ? "text-accent" : "text-text-muted"} />
                      <span className="flex-1 text-sm font-semibold">{cmd.label}</span>
                      {cmd.description && (
                        <span className="text-[11px] text-text-muted truncate max-w-[220px]">
                          {cmd.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
