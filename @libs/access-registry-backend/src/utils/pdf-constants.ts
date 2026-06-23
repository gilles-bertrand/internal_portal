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

export const TABLE_COLUMNS = [
  { key: "seq", label: "#", width: 26 },
  { key: "accessedAt", label: "Date", width: 68 },
  { key: "dataSubjectRef", label: "Personne", width: 72 },
  { key: "accessType", label: "Type", width: 58 },
  { key: "purpose", label: "Finalité", width: 68 },
  { key: "isSpecialCategory", label: "Art.9", width: 32 },
  { key: "hash", label: "Hash", width: CONTENT_WIDTH - 324 },
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
