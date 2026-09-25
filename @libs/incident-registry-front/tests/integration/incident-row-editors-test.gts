import { describe, expect as hardExpect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { click, fillIn, render } from '@ember/test-helpers';
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

// Brouillon complet : en mode `edit`, `furthestStepIndex` démarre à la dernière
// étape, donc l'indicateur permet de sauter directement sur n'importe quelle
// étape sans rejouer les huit gates.
function completeDraft(): DraftIncident {
  return {
    version: '1.0',
    classification: 'CONFIDENTIEL',
    status: 'resolved',
    environment: 'production',
    reportDate: '2026-02-20T10:00:00.000Z',
    applicationName: 'Portail Admin',
    applicationDetail: 'Module auth',
    clientCode: 'IPBW',
    clientName: 'IPBW SA',
    reportedBy: 'Support',
    recipientName: 'DSI',
    recipientOrg: 'IPBW',
    legalContext: 'Cadre RGPD',
    serviceName: 'API Auth',
    deployedVersion: '1.0',
    incidentStartAt: '2026-02-19T08:00:00.000Z',
    incidentEndAt: null,
    detectedAt: '2026-02-19T08:15:00.000Z',
    resolvedAt: null,
    description: 'Incident test',
    personalDataImpacted: true,
    specialCategoryData: false,
    apdNotificationRequired: false,
    impactSummary: '50 utilisateurs impactés',
    immediateCause: 'Régression',
    conclusion: 'Résolu',
    contributingFactors: [],
    correctiveActions: [],
    preventiveMeasures: [],
    descriptionSections: [],
    accessLogs: [],
    timelineEvents: [{ date: '2026-02-19', time: '08:00', event: 'Début' }],
    issuerSignature: { name: '', date: '' },
    recipientSignature: { name: '', date: '' },
  };
}

async function renderEditForm(context: { owner: Owner }) {
  initializeTestApp(context.owner, 'fr-fr');
  stubRouter(context.owner);
  const intl: IntlService = context.owner.lookup('service:intl');
  const changeset = new IncidentChangeset(completeDraft());
  const validationSchema = createIncidentValidationSchema(intl);

  await render(
    <template>
      <IncidentForm
        @changeset={{changeset}}
        @validationSchema={{validationSchema}}
        @mode="edit"
      />
    </template>
  );

  return changeset;
}

function goToStep(index: number) {
  return click(`[data-test-incident-step-link="${index}"]`);
}

describe('incident-form — éditeurs de lignes répétables', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  // @lat: [[frontend/incident-registry-wizard#Les composants Tpk contextuels doivent être invoqués en bloc]]
  //
  // LE test qui manquait. `TpkInput`/`TpkTextarea` sont contextuels : invoqués
  // en auto-fermant ils ne rendent aucun champ, sans la moindre erreur — ni
  // TypeScript, ni eslint, ni ember-template-lint, ni les 45 tests existants ne
  // le voyaient. Résultat : les cinq éditeurs répétables ET les quatre champs de
  // signature étaient vides à l'écran, et l'étape 5 (timeline `min(1)`) était
  // infranchissable, donc le formulaire non soumettable.
  //
  // On assert donc la présence des champs eux-mêmes, étape par étape.
  renderingTest(
    'Chaque éditeur répétable rend réellement ses champs',
    async function ({ context }) {
      await renderEditForm(context);

      // Étape 3 — blocs de description.
      await goToStep(2);
      expect(
        document.querySelector('[data-test-section-title]')
      ).not.toBeNull();
      expect(
        document.querySelector('[data-test-section-detail]')
      ).not.toBeNull();

      // Étape 5 — chronologie.
      await goToStep(4);
      expect(
        document.querySelector('[data-test-timeline-date]')
      ).not.toBeNull();
      expect(
        document.querySelector('[data-test-timeline-time]')
      ).not.toBeNull();
      expect(
        document.querySelector('[data-test-timeline-event]')
      ).not.toBeNull();

      // Étape 6 — facteurs, actions correctives (avec sa date de réalisation,
      // qui n'avait aucun input alors que le champ existait déjà dans le
      // brouillon et dans le modèle backend) et mesures préventives.
      await goToStep(5);
      expect(
        document.querySelectorAll('[data-test-string-list-input]')
      ).toHaveLength(2);
      expect(document.querySelector('[data-test-action-title]')).not.toBeNull();
      expect(
        document.querySelector('[data-test-action-detail]')
      ).not.toBeNull();
      expect(
        document.querySelector('[data-test-action-completed-at]')
      ).not.toBeNull();

      // Étape 8 — annexes et les quatre champs de signature.
      await goToStep(7);
      expect(document.querySelector('[data-test-log-date]')).not.toBeNull();
      expect(document.querySelector('[data-test-log-user]')).not.toBeNull();
      expect(document.querySelector('[data-test-log-email]')).not.toBeNull();
      expect(
        document.querySelector('[data-test-issuer-signature-name]')
      ).not.toBeNull();
      expect(
        document.querySelector('[data-test-recipient-signature-name]')
      ).not.toBeNull();
    }
  );

  renderingTest(
    'Ajoute un bloc de description dans le changeset',
    async function ({ context }) {
      const changeset = await renderEditForm(context);

      await goToStep(2);
      await fillIn('[data-test-section-title]', 'Chronologie');
      await fillIn('[data-test-section-detail]', 'Détail du bloc');
      await click(
        '[data-test-incident-description-sections] button[data-test-tpk-button]'
      );

      expect(changeset.get('descriptionSections')).toEqual([
        { title: 'Chronologie', detail: 'Détail du bloc' },
      ]);
      // Le brouillon est vidé, prêt pour la ligne suivante.
      expect(
        document.querySelector<HTMLInputElement>('[data-test-section-title]')
          ?.value
      ).toBe('');
    }
  );

  renderingTest(
    'Ajoute un événement de chronologie dans le changeset',
    async function ({ context }) {
      const changeset = await renderEditForm(context);

      await goToStep(4);
      await fillIn('[data-test-timeline-date]', '2026-02-19');
      await fillIn('[data-test-timeline-time]', '09:30');
      await fillIn('[data-test-timeline-event]', 'Confinement');
      await click('[data-test-incident-timeline] button[data-test-tpk-button]');

      expect(changeset.get('timelineEvents')).toEqual([
        { date: '2026-02-19', time: '08:00', event: 'Début' },
        { date: '2026-02-19', time: '09:30', event: 'Confinement' },
      ]);
    }
  );

  renderingTest(
    'Refuse une ligne incomplète et le dit au lieu de ne rien faire',
    async function ({ context }) {
      const changeset = await renderEditForm(context);

      await goToStep(2);
      await fillIn('[data-test-section-title]', 'Titre seul');
      await click(
        '[data-test-incident-description-sections] button[data-test-tpk-button]'
      );

      expect(changeset.get('descriptionSections')).toEqual([]);
      // Avant, le bouton sortait en silence : aucun retour visible.
      expect(
        document
          .querySelector(
            '[data-test-incident-description-sections] [data-test-row-hint]'
          )
          ?.textContent?.trim()
      ).toContain('incompleteRow');
    }
  );

  // @lat: [[frontend/incident-registry-wizard#Les composants Tpk contextuels doivent être invoqués en bloc]]
  //
  // `<input type="date">` remonte `valueAsDate`, donc un objet Date : sans
  // normalisation la ligne stockerait « Thu Feb 19 2026 00:00:00 GMT… », que le
  // backend et le PDF réafficheraient tel quel.
  renderingTest(
    'Normalise une date de ligne en yyyy-MM-dd',
    async function ({ context }) {
      const changeset = await renderEditForm(context);

      await goToStep(5);
      await fillIn('[data-test-action-title]', 'Correctif');
      await fillIn('[data-test-action-detail]', 'Politique restaurée');
      await fillIn('[data-test-action-completed-at]', '2026-02-19');
      await click(
        '[data-test-incident-corrective-actions] button[data-test-tpk-button]'
      );

      const actions = changeset.get('correctiveActions') ?? [];
      expect(actions).toHaveLength(1);
      expect(actions[0]?.completedAt).toBe('2026-02-19');
    }
  );
});
