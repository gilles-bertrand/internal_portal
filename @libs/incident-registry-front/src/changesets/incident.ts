import ImmerChangeset from 'ember-immer-changeset';
import type { ValidatedIncident } from '#src/components/forms/incident-validation.ts';

export type DraftIncident = Partial<ValidatedIncident>;

export class IncidentChangeset extends ImmerChangeset<DraftIncident> {}
