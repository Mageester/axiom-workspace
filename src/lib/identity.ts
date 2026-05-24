export function normalizeDisplayName(name?: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Someone";

  const normalized = trimmed
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized.startsWith("riley")) return "Riley";
  if (normalized.startsWith("aidan")) return "Aidan";

  const first = trimmed.split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Someone";
}

export function samePerson(a?: string, b?: string): boolean {
  return normalizeDisplayName(a).toLowerCase() === normalizeDisplayName(b).toLowerCase();
}
