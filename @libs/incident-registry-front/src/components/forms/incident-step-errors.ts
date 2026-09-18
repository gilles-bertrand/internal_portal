import {
  INCIDENT_FORM_STEPS,
  stepForField,
  validateIncidentStep,
  type IncidentFormStep,
} from '#src/components/forms/incident-validation.ts';
import type IntlService from 'ember-intl/services/intl';
import type { ZodIssue } from 'zod';

// Pure helpers backing the incident wizard's error reporting. Kept out of
// incident-form.gts so they can be unit-tested without rendering the form —
// the wizard's step gating had no test coverage at all until now.

export interface StepFieldIssue {
  // Root field of the issue: what the summary message names, and what maps
  // back to a wizard step.
  field: string;
  // Dotted path of the issue (`correctiveActions.0.title`), i.e. the key the
  // changeset uses so the right input shows the right inline error.
  path: string;
  message: string;
}

// Fields whose label lives under another key than `incidents.form.<field>`
// (repeatable editors and signature groups have a section label instead).
const FIELD_LABEL_ALIASES: Record<string, string> = {
  descriptionSections: 'incidents.form.sections.descriptionBlocks',
  timelineEvents: 'incidents.form.sections.timeline',
  correctiveActions: 'incidents.form.sections.correctiveActions',
  accessLogs: 'incidents.form.sections.accessLogs',
  issuerSignature: 'incidents.form.issuerSignatureName',
  recipientSignature: 'incidents.form.recipientSignatureName',
};

export function fieldLabelKey(field: string): string {
  return FIELD_LABEL_ALIASES[field] ?? `incidents.form.${field}`;
}

// A code/field may have no key at all (schema field added before its label),
// so callers degrade to the raw field name rather than rendering a missing
// translation marker — same defensive rule as the access-registry views.
export function fieldLabel(field: string, intl: IntlService): string {
  const key = fieldLabelKey(field);
  return intl.exists(key) ? intl.t(key) : field;
}

// Zod reports `path: ['correctiveActions', 0, 'title']`; the changeset wants
// the dotted form, and the human summary wants the root field only.
export function issuesToStepFields(issues: ZodIssue[]): StepFieldIssue[] {
  const seen = new Set<string>();
  const mapped: StepFieldIssue[] = [];
  for (const issue of issues) {
    const path = issue.path.map(String);
    const field = path[0] ?? '';
    const dotted = path.join('.');
    if (!field || seen.has(dotted)) {
      continue;
    }
    seen.add(dotted);
    mapped.push({ field, path: dotted, message: issue.message });
  }
  return mapped;
}

// Distinct field labels, in issue order — what the summary alert lists.
export function invalidFieldLabels(
  issues: ZodIssue[],
  intl: IntlService
): string[] {
  const labels: string[] = [];
  for (const { field } of issuesToStepFields(issues)) {
    const label = fieldLabel(field, intl);
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }
  return labels;
}

export interface InvalidStep {
  step: IncidentFormStep;
  index: number;
  issues: ZodIssue[];
}

// First step (in wizard order) that does not pass its own validation.
//
// This is what makes the final submit honest: TpkForm validates the WHOLE
// schema and silently aborts when it fails, but on a wizard the offending
// field usually belongs to a step that is not rendered — so the user clicks
// "Save" and, from their point of view, absolutely nothing happens. Walking
// the steps lets the form bring them back to the one that actually blocks.
export function firstInvalidStep(
  snapshot: Record<string, unknown>,
  intl: IntlService
): InvalidStep | null {
  for (const [index, step] of INCIDENT_FORM_STEPS.entries()) {
    const result = validateIncidentStep(step, snapshot, intl);
    if (!result.ok) {
      return { step, index, issues: result.issues };
    }
  }
  return null;
}

// Step owning `field`, for callers that hold an issue rather than a step.
export { stepForField };
