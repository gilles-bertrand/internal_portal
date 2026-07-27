import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { formatDate, truncate } from "#src/utils/pdf-constants.js";

// Cellules de la ligne récapitulative (liste page 1), dans l'ordre de
// SUMMARY_COLUMNS. Version compacte : le détail complet est en fiche dédiée.
// @lat: [[backend/access-registry#Export PDF : liste puis détail]]
export function buildSummaryCells(record: AccessRecordEntityType): string[] {
  return [
    String(record.seq),
    formatDate(record.accessedAt),
    truncate(record.dataSubjectRef, 16),
    truncate(record.accessType, 12),
    truncate(record.purpose, 13),
    record.isSpecialCategory ? "Oui" : "Non",
    truncate(record.sourceSystem, 15),
    truncate(record.hash, 20),
  ];
}
