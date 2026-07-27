import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { formatDate } from "#src/utils/pdf-constants.js";

export interface DetailRow {
  key: string;
  label: string;
  value: string;
  /** Rendu en police à chasse fixe (hash) et sur toute la largeur. */
  mono?: boolean;
}

// Construit la liste exhaustive (label → valeur) des champs d'un enregistrement
// d'accès pour la fiche détaillée du PDF — aucun champ masqué, aucune troncature.
// @lat: [[backend/access-registry#Export PDF : liste puis détail]]
export function buildRecordDetailRows(record: AccessRecordEntityType): DetailRow[] {
  const categories = Array.isArray(record.dataCategories)
    ? (record.dataCategories as string[]).join(", ")
    : String(record.dataCategories ?? "");

  return [
    { key: "seq", label: "Séquence", value: String(record.seq) },
    { key: "accessedAt", label: "Date d'accès", value: formatDate(record.accessedAt) },
    { key: "encodedAt", label: "Encodé le", value: formatDate(record.encodedAt) },
    { key: "encodedBy", label: "Encodé par", value: record.encodedBy },
    { key: "accessorRef", label: "Accédant", value: record.accessorRef },
    { key: "dataSubjectRef", label: "Personne concernée", value: record.dataSubjectRef },
    { key: "dataCategories", label: "Catégories", value: categories || "—" },
    {
      key: "isSpecialCategory",
      label: "Données art. 9",
      value: record.isSpecialCategory ? "Oui" : "Non",
    },
    { key: "accessType", label: "Type d'accès", value: record.accessType },
    { key: "purpose", label: "Finalité", value: record.purpose },
    { key: "legalBasis", label: "Base légale", value: record.legalBasis },
    { key: "sourceSystem", label: "Système source", value: record.sourceSystem },
    { key: "recipient", label: "Destinataire", value: record.recipient ?? "—" },
    { key: "justification", label: "Justification", value: record.justification },
    {
      key: "retentionUntil",
      label: "Conservation",
      value: formatDate(record.retentionUntil),
    },
    { key: "prevHash", label: "Hash précédent", value: record.prevHash, mono: true },
    { key: "hash", label: "Hash", value: record.hash, mono: true },
  ];
}
