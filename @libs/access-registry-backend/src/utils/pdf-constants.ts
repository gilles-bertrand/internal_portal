export const PAGE = { width: 595.28, height: 841.89 };
export const MARGIN = { top: 48, right: 48, bottom: 56, left: 48 };
export const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

export const COLORS = {
  primary: "#1e3a5f",
  accent: "#0284c7",
  success: "#059669",
  successBg: "#ecfdf5",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  surface: "#f8fafc",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  white: "#ffffff",
  rowAlt: "#f1f5f9",
};

// Colonnes de la liste récapitulative (page 1) : une ligne par enregistrement.
export const SUMMARY_COLUMNS = [
  { key: "seq", label: "#", width: 24 },
  { key: "accessedAt", label: "Date", width: 66 },
  { key: "dataSubjectRef", label: "Personne", width: 74 },
  { key: "accessType", label: "Type", width: 56 },
  { key: "purpose", label: "Finalité", width: 62 },
  { key: "isSpecialCategory", label: "Art.9", width: 30 },
  { key: "sourceSystem", label: "Source", width: 72 },
  { key: "hash", label: "Hash", width: CONTENT_WIDTH - 384 },
] as const;

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}
