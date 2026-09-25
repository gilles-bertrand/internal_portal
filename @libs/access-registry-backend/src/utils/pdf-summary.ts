import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { formatDate } from "#src/utils/pdf-constants.js";

// Cellules de la ligne récapitulative (liste page 1), dans l'ordre de
// SUMMARY_COLUMNS. Valeurs COMPLÈTES : la troncature n'est plus faite au
// caractère ici (une limite en nombre de caractères ignore la largeur réelle des
// glyphes et débordait ou coupait à tort), elle est appliquée à la mesure par le
// rendu — cf. [[@libs/backend-shared/src/pdf/text.ts#fitText]].
// @lat: [[backend/access-registry#Export PDF : liste puis détail]]
export function buildSummaryCells(record: AccessRecordEntityType): string[] {
  return [
    String(record.seq),
    formatDate(record.accessedAt),
    record.dataSubjectRef,
    record.accessType,
    record.purpose,
    record.isSpecialCategory ? "Oui" : "Non",
    record.sourceSystem,
    record.hash,
  ];
}
