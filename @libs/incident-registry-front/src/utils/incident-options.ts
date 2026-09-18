// Single source of truth for the incident registry's enumerated option values.
//
// Unlike access-registry's purpose/legalBasis/dataCategories, these four enums
// have NO backend referential (see [[incident-registry]] — "Business enums
// duplicated front/back"), so the values live here and are imported by BOTH the
// validation schema (z.enum) and the display layer (table filters, form
// selects) — the allowed set can therefore never drift between the two.
//
// Same "approach B" as access-registry's accessType: the PERSISTED value stays
// the stable untranslated code (`in_progress`, `CONFIDENTIEL`, …), only the
// DISPLAYED label goes through i18n. Rendered raw, those codes showed
// snake_case and French words inside an otherwise English UI.
// See [[frontend/access-record-options#Libellés bilingues résolus côté frontend]].

export const INCIDENT_CLASSIFICATIONS = [
  'CONFIDENTIEL',
  'INTERNE',
  'PUBLIC',
] as const;

export const INCIDENT_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;

export const INCIDENT_ENVIRONMENTS = [
  'production',
  'staging',
  'development',
] as const;

export const INCIDENT_SEVERITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type IncidentClassification = (typeof INCIDENT_CLASSIFICATIONS)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentEnvironment = (typeof INCIDENT_ENVIRONMENTS)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

// Translation keys. Kept next to their enum so adding a value here is an
// immediate reminder to add its key in both locale files.
export function statusLabelKey(value: string): string {
  return `incidents.options.status.${value}`;
}

export function classificationLabelKey(value: string): string {
  return `incidents.options.classification.${value}`;
}

export function environmentLabelKey(value: string): string {
  return `incidents.options.environment.${value}`;
}

export function severityLabelKey(value: string): string {
  return `incidents.options.severity.${value}`;
}

// Option shape consumed by TpkSelect / TpkSelectPrefab, mirroring
// access-record-form.gts's `referentialOption`: `value` is the stored code,
// `label` the displayed text. The custom `toString` is REQUIRED because
// power-select renders each option via `String(option)` — without it the
// dropdown shows "[object Object]".
export interface LabelledOption {
  value: string;
  label: string;
  toString(): string;
}

export function labelledOption(value: string, label: string): LabelledOption {
  return { value, label, toString: () => label };
}

// A code may legitimately fall outside the enum (historical row, value added
// backend-side first), so callers pass an `exists` probe and we degrade to the
// raw code rather than rendering a missing-translation marker — same defensive
// rule as access-registry's views.
export function optionLabel(
  value: string,
  labelKey: (value: string) => string,
  intl: { exists(key: string): boolean; t(key: string): string }
): string {
  const key = labelKey(value);
  return intl.exists(key) ? intl.t(key) : value;
}
