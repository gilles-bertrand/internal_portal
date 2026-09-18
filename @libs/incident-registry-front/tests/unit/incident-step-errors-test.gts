import { describe, expect, test } from 'vitest';
import type { IntlService } from 'ember-intl';
import type { ZodIssue } from 'zod';
import {
  fieldLabel,
  fieldLabelKey,
  firstInvalidStep,
  invalidFieldLabels,
  issuesToStepFields,
} from '#src/components/forms/incident-step-errors.ts';
import {
  INCIDENT_FORM_STEPS,
  INCIDENT_STEP_FIELDS,
  stepForField,
  validateIncidentStep,
} from '#src/components/forms/incident-validation.ts';

// A lib test has no app translations loaded, so `t` echoes the key: asserting
// on keys is both precise and locale-proof.
const fakeIntl = {
  t: (key: string) => key,
  exists: () => true,
} as unknown as IntlService;

// Same intl with no translation at all, to check the raw-field-name fallback.
const emptyIntl = {
  t: (key: string) => key,
  exists: () => false,
} as unknown as IntlService;

// A snapshot that passes every step — the shape `snapshotChangeset()` produces.
const COMPLETE = {
  reportDate: '2026-02-20T10:00:00.000Z',
  version: '1.0',
  classification: 'CONFIDENTIEL',
  status: 'resolved',
  applicationName: 'Portail Admin',
  applicationDetail: 'Module auth',
  environment: 'production',
  clientCode: 'IPBW',
  clientName: 'IPBW SA',
  reportedBy: 'Support',
  recipientName: 'DSI',
  recipientOrg: 'IPBW',
  legalContext: 'Cadre RGPD',
  serviceName: 'API Auth',
  deployedVersion: '2.4.1',
  incidentStartAt: '2026-02-19T08:00:00.000Z',
  detectedAt: '2026-02-19T08:15:00.000Z',
  description: 'Incident test',
  personalDataImpacted: true,
  specialCategoryData: false,
  impactSummary: '50 utilisateurs impactés',
  immediateCause: 'Régression',
  contributingFactors: [],
  correctiveActions: [],
  preventiveMeasures: [],
  conclusion: 'Résolu',
  timelineEvents: [{ date: '2026-02-19', time: '08:00', event: 'Début' }],
};

function issue(path: (string | number)[], message: string): ZodIssue {
  return { code: 'custom', path, message } as unknown as ZodIssue;
}

// @lat: [[frontend/incident-registry-wizard#Erreurs d'étape par champ]]
describe('issuesToStepFields', () => {
  test('exposes the root field and the dotted changeset path', () => {
    const mapped = issuesToStepFields([
      issue(['clientCode'], 'Required'),
      issue(['correctiveActions', 0, 'title'], 'Required'),
    ]);

    expect(mapped).toEqual([
      { field: 'clientCode', path: 'clientCode', message: 'Required' },
      {
        field: 'correctiveActions',
        path: 'correctiveActions.0.title',
        message: 'Required',
      },
    ]);
  });

  test('keeps only the first issue per path, and drops path-less issues', () => {
    const mapped = issuesToStepFields([
      issue(['clientCode'], 'first'),
      issue(['clientCode'], 'second'),
      issue([], 'form-level'),
    ]);

    expect(mapped).toEqual([
      { field: 'clientCode', path: 'clientCode', message: 'first' },
    ]);
  });
});

describe('field labels', () => {
  test('repeatable editors resolve to their section label', () => {
    expect(fieldLabelKey('timelineEvents')).toBe(
      'incidents.form.sections.timeline'
    );
    expect(fieldLabelKey('correctiveActions')).toBe(
      'incidents.form.sections.correctiveActions'
    );
    expect(fieldLabelKey('issuerSignature')).toBe(
      'incidents.form.issuerSignatureName'
    );
  });

  test('a plain field resolves to its own form label', () => {
    expect(fieldLabelKey('clientCode')).toBe('incidents.form.clientCode');
  });

  test('a field with no translation degrades to its raw name', () => {
    expect(fieldLabel('clientCode', emptyIntl)).toBe('clientCode');
  });

  test('the summary lists each faulty field once, in issue order', () => {
    const labels = invalidFieldLabels(
      [
        issue(['clientName'], 'Required'),
        issue(['clientCode'], 'Required'),
        issue(['clientCode'], 'Too small'),
      ],
      fakeIntl
    );

    expect(labels).toEqual([
      'incidents.form.clientName',
      'incidents.form.clientCode',
    ]);
  });
});

describe('firstInvalidStep', () => {
  test('an empty draft blocks on the very first step', () => {
    const failing = firstInvalidStep({}, fakeIntl);

    expect(failing?.step).toBe('header');
    expect(failing?.index).toBe(0);
    expect(failing?.issues.length).toBeGreaterThan(0);
  });

  test('a complete draft blocks on no step at all', () => {
    expect(firstInvalidStep(COMPLETE, fakeIntl)).toBeNull();
  });

  test('reports the later step that is actually missing data', () => {
    // Everything filled except the conclusion, which belongs to the 7th step:
    // this is exactly the case where TpkForm used to abort the submit with no
    // visible reason, since `conclusion` is not rendered on the last step.
    const failing = firstInvalidStep({ ...COMPLETE, conclusion: '' }, fakeIntl);

    expect(failing?.step).toBe('closing');
    expect(failing?.index).toBe(INCIDENT_FORM_STEPS.indexOf('closing'));
    expect(invalidFieldLabels(failing?.issues ?? [], fakeIntl)).toEqual([
      'incidents.form.conclusion',
    ]);
  });

  test('walks the steps in wizard order, reporting the earliest failure', () => {
    const failing = firstInvalidStep(
      { ...COMPLETE, clientCode: '', conclusion: '' },
      fakeIntl
    );

    expect(failing?.step).toBe('header');
  });
});

// @lat: [[frontend/incident-registry-wizard#Un champ appartient à une seule étape]]
describe('step ownership', () => {
  test('every validated field maps back to exactly one step', () => {
    for (const step of INCIDENT_FORM_STEPS) {
      for (const field of INCIDENT_STEP_FIELDS[step]) {
        expect(stepForField(field as string)).toBe(step);
      }
    }
  });

  test('a field outside the wizard maps to no step', () => {
    expect(stepForField('reference')).toBeUndefined();
  });

  test('each step validates in isolation from the other steps', () => {
    // The gate must never fail on a field owned by another step, otherwise the
    // user is blocked on step 1 by something only step 5 asks for.
    for (const step of INCIDENT_FORM_STEPS) {
      const onlyThisStep: Record<string, unknown> = {};
      for (const field of INCIDENT_STEP_FIELDS[step]) {
        onlyThisStep[field as string] =
          COMPLETE[field as keyof typeof COMPLETE];
      }
      expect(validateIncidentStep(step, onlyThisStep, fakeIntl).ok).toBe(true);
    }
  });
});
