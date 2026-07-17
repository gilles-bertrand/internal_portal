// Single source of truth for the enumerated access-record option values that
// have NO backend referential (unlike legalBasis/dataCategories/purpose,
// which are fetched from /legal-bases, /data-categories and /purposes — see
// [[frontend/access-record-options#Référentiels dynamiques vs enum statique]]).
// Imported by the validation schema (z.enum) AND the form (select getter) so
// the allowed values never drift between the two layers.

// accessType — Approach A: the value IS the displayed label (already French
// words, identical in both locales), so no per-option i18n keys are needed.
export const ACCESS_TYPES = [
  'consultation',
  'modification',
  'export',
  'transmission',
] as const;

export type AccessType = (typeof ACCESS_TYPES)[number];
