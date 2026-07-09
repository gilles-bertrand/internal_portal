import ImmerChangeset from 'ember-immer-changeset';
import type { ValidatedIncident } from '#src/components/forms/incident-validation.ts';

// @lat: [[frontend/forms#Valeur initiale null obligatoire pour TpkDatepickerPrefab]]
// reportDate/incidentStartAt/detectedAt are required strings in ValidatedIncident
// (no null in their zod type), but TpkValidationDatepicker's `value` getter
// asserts on string | Date | null — never undefined. The draft must be able to
// hold `null` while the field is still empty, so we widen just these three.
//
// @lat: [[frontend/forms#Stocker un Date, pas une string, pendant l'édition]]
// All 5 fields are declared as string (or string|null) here to satisfy
// TpkForm's changeset<->schema type coupling, but setDateField in
// incident-form.gts actually stores a runtime Date, cast through this type —
// incident-validation.ts converts it back to ISO at validation.
export type DraftIncident = Omit<
  Partial<ValidatedIncident>,
  'reportDate' | 'incidentStartAt' | 'detectedAt'
> & {
  reportDate?: string | null;
  incidentStartAt?: string | null;
  detectedAt?: string | null;
};

export class IncidentChangeset extends ImmerChangeset<DraftIncident> {}
