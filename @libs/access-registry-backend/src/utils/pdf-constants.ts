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
// Largeurs calibrées sur la mesure réelle du contenu le plus large attendu (une
// date `jj/mm/aaaa hh:mm` fait 58,4 pt en Helvetica 7,5 — l'ancienne colonne de
// 66 pt, padding déduit, la coupait sur deux lignes).
export const SUMMARY_COLUMNS = [
  { key: "seq", label: "#", width: 24 },
  { key: "accessedAt", label: "Date", width: 76 },
  { key: "dataSubjectRef", label: "Donnée", width: 92 },
  { key: "accessType", label: "Type", width: 60 },
  { key: "purpose", label: "Finalité", width: 58 },
  { key: "isSpecialCategory", label: "Art.9", width: 30 },
  { key: "sourceSystem", label: "Source", width: 72 },
  { key: "hash", label: "Hash", width: CONTENT_WIDTH - 412 },
] as const;

/** Padding horizontal interne d'une cellule du récapitulatif. */
export const SUMMARY_CELL_PADDING = 8;

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
