import { describe, expect as hardExpect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { click, render } from '@ember/test-helpers';
import { IncidentChangeset } from '#src/changesets/incident.ts';
import IncidentForm from '#src/components/forms/incident-form.gts';
import { initializeTestApp, TestApp } from '../app.ts';
import { stubRouter } from '../utils.ts';
import { createIncidentValidationSchema } from '#src/components/forms/incident-validation.ts';
import type Owner from '@ember/owner';
import type { IntlService } from 'ember-intl';
import type { DraftIncident } from '#src/changesets/incident.ts';

const expect = hardExpect.soft;

vi.mock('@libs/shared-front/services/handle-save', async () => {
  const { default: EmberService } = await import('@ember/service');
  return {
    default: class MockHandleSaveService extends EmberService {
      handleSave = vi.fn().mockResolvedValue(undefined);
    },
  };
});

// The defaults the create route seeds (see create-template.gts): the enums and
// the arrays are pre-filled, every free-text field is empty.
function emptyDraft() {
  return {
    version: '1.0',
    classification: 'CONFIDENTIEL' as const,
    status: 'open' as const,
    environment: 'production' as const,
    personalDataImpacted: false,
    specialCategoryData: false,
    apdNotificationRequired: false,
    // TpkValidationDatepicker asserts string | Date | null — never undefined —
    // so these must be explicitly null, not omitted.
    reportDate: null,
    recipientName: '',
    recipientOrg: '',
    deployedVersion: '1.0',
    incidentStartAt: null,
    incidentEndAt: null,
    detectedAt: null,
    resolvedAt: null,
    contributingFactors: [],
    correctiveActions: [],
    preventiveMeasures: [],
    timelineEvents: [],
    descriptionSections: [],
    accessLogs: [],
    issuerSignature: { name: '', date: '' },
    recipientSignature: { name: '', date: '' },
  };
}

// A draft that satisfies every step, so navigation can be exercised without
// fighting the datepicker widget through the DOM.
function completeDraft() {
  return {
    ...emptyDraft(),
    reportDate: '2026-02-20T10:00:00.000Z',
    status: 'resolved' as const,
    applicationName: 'Portail Admin',
    applicationDetail: 'Module auth',
    clientCode: 'IPBW',
    clientName: 'IPBW SA',
    reportedBy: 'Support',
    recipientName: 'DSI',
    recipientOrg: 'IPBW',
    legalContext: 'Cadre RGPD',
    serviceName: 'API Auth',
    incidentStartAt: '2026-02-19T08:00:00.000Z',
    detectedAt: '2026-02-19T08:15:00.000Z',
    description: 'Incident test',
    personalDataImpacted: true,
    impactSummary: '50 utilisateurs impactés',
    immediateCause: 'Régression',
    conclusion: 'Résolu',
    timelineEvents: [{ date: '2026-02-19', time: '08:00', event: 'Début' }],
  };
}

function step(index: number): HTMLElement | null {
  return document.querySelector(`[data-test-incident-step="${index}"]`);
}

function currentStepIndex(): number {
  const steps = [...document.querySelectorAll('[data-test-incident-step]')];
  return steps.findIndex((el) => el.getAttribute('aria-current') === 'step');
}

function stepError(): string {
  return (
    document
      .querySelector('[data-test-incident-step-error]')
      ?.textContent?.trim() ?? ''
  );
}

function renderedFields(): string[] {
  return [
    ...document.querySelectorAll(
      '[data-test-tpk-prefab-input-container],[data-test-tpk-prefab-select-container],[data-test-tpk-prefab-datepicker-container],[data-test-tpk-prefab-textarea-container]'
    ),
  ].map(
    (el) =>
      el.getAttribute('data-test-tpk-prefab-input-container') ??
      el.getAttribute('data-test-tpk-prefab-select-container') ??
      el.getAttribute('data-test-tpk-prefab-datepicker-container') ??
      el.getAttribute('data-test-tpk-prefab-textarea-container') ??
      ''
  );
}

async function renderForm(
  context: { owner: Owner },
  draft: DraftIncident,
  mode?: 'create' | 'edit'
) {
  initializeTestApp(context.owner, 'fr-fr');
  stubRouter(context.owner);
  const intl: IntlService = context.owner.lookup('service:intl');
  const changeset = new IncidentChangeset(draft);
  const validationSchema = createIncidentValidationSchema(intl);
  const formMode = mode;

  await render(
    <template>
      <IncidentForm
        @changeset={{changeset}}
        @validationSchema={{validationSchema}}
        @mode={{formMode}}
      />
    </template>
  );

  return changeset;
}

describe('incident-form', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  renderingTest(
    'Rend le formulaire multi-étapes sur la première étape',
    async function ({ context }) {
      await renderForm(context, emptyDraft());

      expect(
        document.querySelector('[data-test-incident-form]')
      ).not.toBeNull();
      expect(
        document.querySelector('[data-test-incident-next]')
      ).not.toBeNull();
      // Pas de "précédent" ni de "soumettre" sur la première étape.
      expect(document.querySelector('[data-test-incident-prev]')).toBeNull();
      expect(document.querySelector('[data-test-incident-submit]')).toBeNull();
      expect(currentStepIndex()).toBe(0);
      expect(
        document.querySelector('[data-test-incident-step-progress]')
      ).not.toBeNull();
      expect(renderedFields()).toContain('clientCode');
    }
  );

  renderingTest(
    "Bloque le passage à l'étape suivante et nomme les champs fautifs",
    async function ({ context }) {
      const changeset = await renderForm(context, emptyDraft());

      await click('[data-test-incident-next]');

      // On reste sur l'étape 1.
      expect(currentStepIndex()).toBe(0);
      expect(renderedFields()).toContain('clientCode');

      // Le message d'étape ne doit plus être la concaténation brute des
      // messages Zod ("Invalid input: expected string, received undefined"),
      // illisible et sans indication du champ concerné.
      const message = stepError();
      expect(message).not.toBe('');
      expect(message).not.toContain('Invalid input');
      expect(message).not.toContain('expected string');
      expect(message).toContain('requiredFields');

      // Et chaque champ fautif porte son erreur inline, comme au submit.
      const errorKeys = changeset.errors.map((e) => e.key);
      expect(errorKeys).toContain('clientCode');
      expect(errorKeys).toContain('clientName');
      expect(errorKeys).toContain('reportDate');
    }
  );

  // @lat: [[frontend/incident-registry-wizard#Navigation entre étapes]]
  renderingTest(
    'Avance puis revient en arrière quand l’étape est valide',
    async function ({ context }) {
      await renderForm(context, completeDraft());

      await click('[data-test-incident-next]');

      expect(currentStepIndex()).toBe(1);
      expect(stepError()).toBe('');
      expect(renderedFields()).toContain('legalContext');
      expect(
        document.querySelector('[data-test-incident-prev]')
      ).not.toBeNull();

      await click('[data-test-incident-prev]');

      expect(currentStepIndex()).toBe(0);
      expect(renderedFields()).toContain('clientCode');
    }
  );

  renderingTest(
    "L'indicateur ne rend cliquables que les étapes déjà validées",
    async function ({ context }) {
      await renderForm(context, completeDraft());

      // Étape 2 pas encore atteinte : pas de bouton, donc pas de saut possible.
      expect(
        step(1)?.querySelector('[data-test-incident-step-link]')
      ).toBeNull();

      await click('[data-test-incident-next]');
      await click('[data-test-incident-next]');
      expect(currentStepIndex()).toBe(2);

      // On revient à l'étape 1 d'un clic sur l'indicateur.
      await click('[data-test-incident-step-link="0"]');
      expect(currentStepIndex()).toBe(0);
      expect(renderedFields()).toContain('clientCode');
    }
  );

  renderingTest(
    "En édition, toutes les étapes sont navigables d'emblée",
    async function ({ context }) {
      // Un incident existant est déjà complet : imposer un parcours linéaire
      // pour corriger une coquille n'aurait aucun sens.
      await renderForm(context, completeDraft(), 'edit');

      expect(
        step(7)?.querySelector('[data-test-incident-step-link]')
      ).not.toBeNull();

      await click('[data-test-incident-step-link="7"]');
      expect(currentStepIndex()).toBe(7);
      expect(
        document.querySelector('[data-test-incident-submit]')
      ).not.toBeNull();
    }
  );

  // @lat: [[frontend/incident-registry-wizard#Pré-vol du submit sur toutes les étapes]]
  renderingTest(
    "Le submit ramène à la première étape incomplète au lieu d'échouer en silence",
    async function ({ context }) {
      // `conclusion` appartient à l'étape 7 : avant le pré-vol, TpkForm
      // annulait le submit sans rien afficher puisque le champ fautif n'était
      // pas rendu sur la dernière étape.
      const changeset = await renderForm(
        context,
        { ...completeDraft(), conclusion: '' },
        'edit'
      );

      await click('[data-test-incident-step-link="7"]');
      expect(currentStepIndex()).toBe(7);

      await click('[data-test-incident-submit]');

      expect(currentStepIndex()).toBe(6);
      expect(renderedFields()).toContain('conclusion');
      expect(stepError()).toContain('otherStepInvalid');
      expect(changeset.errors.map((e) => e.key)).toContain('conclusion');
    }
  );
});
