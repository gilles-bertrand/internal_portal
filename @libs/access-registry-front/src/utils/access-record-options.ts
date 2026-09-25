// Single source of truth for the enumerated access-record option values that
// have NO backend referential (unlike legalBasis/dataCategories/purpose,
// which are fetched from /legal-bases, /data-categories and /purposes — see
// [[frontend/access-record-options#Référentiels dynamiques vs enum statique]]).
// Imported by the validation schema (z.enum) AND the form (select getter) so
// the allowed values never drift between the two layers.

// accessType — the stored value is a stable, untranslated code; its displayed
// label comes from i18n (see accessTypeLabelKey below). It used to be rendered
// raw ("consultation"), which showed lowercase French words inside an otherwise
// English UI — the same FR/EN mix the referentials had before going bilingual.
// Persisted values are unchanged: only the display layer is translated.
export const ACCESS_TYPES = [
  'consultation',
  'modification',
  'export',
  'transmission',
] as const;

export type AccessType = (typeof ACCESS_TYPES)[number];

// @lat: [[frontend/access-record-options#Libellés bilingues résolus côté frontend]]
// Translation key of an access type. Kept next to ACCESS_TYPES so adding a
// value here is an immediate reminder to add its key in both locale files.
export function accessTypeLabelKey(value: string): string {
  return `access-records.options.accessType.${value}`;
}
