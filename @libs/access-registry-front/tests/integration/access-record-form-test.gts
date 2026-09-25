import { describe, expect as hardExpect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { click, render } from '@ember/test-helpers';
import { AccessRecordChangeset } from '#src/changesets/access-record.ts';
import AccessRecordForm, {
  pageObject,
} from '#src/components/forms/access-record-form.gts';
import { initializeTestApp, TestApp } from '../app.ts';
import { stubRouter } from '../utils.ts';
import { createAccessRecordValidationSchema } from '#src/components/forms/access-record-validation.ts';
import type { Purpose } from '#src/schemas/purposes.ts';
import type { LegalBasis } from '#src/schemas/legal-bases.ts';
import type { DataCategory } from '#src/schemas/data-categories.ts';
import type { SourceSystem } from '#src/schemas/source-systems.ts';
import type { EligibleAccessor } from '#src/schemas/eligible-accessors.ts';

const expect = hardExpect.soft;

// purpose/legalBasis/dataCategories are backed by backend referentials (see
// [[frontend/access-record-options#Référentiels dynamiques vs enum statique]])
// fetched by the route's model() — the form only consumes the resulting
// arrays, so tests pass plain fixtures instead of going through the store.
const PURPOSES = [
  { code: 'support', label: 'Support client' },
] as unknown as Purpose[];
const LEGAL_BASES = [
  { code: 'consent', label: 'Consentement', isArticle9: false },
  { code: 'contract', label: "Exécution d'un contrat", isArticle9: false },
] as unknown as LegalBasis[];
const DATA_CATEGORIES = [
  { code: 'identification', label: 'Identification' },
  { code: 'health', label: 'Santé' },
] as unknown as DataCategory[];
const SOURCE_SYSTEMS = [
  { code: 'crm', label: 'CRM' },
  { code: 'erp', label: 'ERP' },
] as unknown as SourceSystem[];
const ELIGIBLE_ACCESSORS = [
  { name: 'Amaury Deflorenne' },
  { name: 'Jeanne Encodeuse' },
] as unknown as EligibleAccessor[];

// Stub minimal de HandleSaveService — on évite d'étendre la vraie classe
// pour ne pas déclencher les injections (@service) non enregistrées en test
// (ErrorReporterService notamment).
vi.mock('@libs/shared-front/services/handle-save', async () => {
  const { default: EmberService } = await import('@ember/service');
  return {
    default: class MockHandleSaveService extends EmberService {
      handleSave = vi.fn().mockResolvedValue(undefined);
    },
  };
});

// Stub du service source-system : `create` renvoie un référentiel figé sans
// toucher au store/réseau, ce qui permet de tester l'affordance « + Ajouter ».
vi.mock('#src/services/source-system.ts', async () => {
  const { default: EmberService } = await import('@ember/service');
  return {
    default: class MockSourceSystemService extends EmberService {
      create = vi.fn().mockResolvedValue({
        code: 'nouveau-systeme',
        label: 'Nouveau Système',
      });
    },
  };
});

// Sélectionne une option d'un TpkSelectPrefab par le texte affiché, en
// pilotant directement ember-power-select via `click` (pas d'import des
// test-support helpers : éviterait de perturber l'optimizer vitest et le
// hoisting de vi.mock). renderInPlace=true → options dans le conteneur.
async function chooseOption(
  validationField: string,
  optionText: string
): Promise<void> {
  const container = document.querySelector(
    `[data-test-tpk-prefab-select-container="${validationField}"]`
  );
  if (!container) {
    throw new Error(`Conteneur select "${validationField}" introuvable`);
  }
  const trigger = container.querySelector('.ember-power-select-trigger');
  if (!trigger) {
    throw new Error(`Trigger select "${validationField}" introuvable`);
  }
  await click(trigger);
  const option = Array.from(
    document.querySelectorAll('.ember-power-select-option')
  ).find((el) => (el.textContent ?? '').includes(optionText));
  if (!option) {
    throw new Error(
      `Option "${optionText}" introuvable pour le champ "${validationField}"`
    );
  }
  await click(option);
}

describe('access-record-form', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  renderingTest(
    'Rend le formulaire avec son attribut data-test',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new AccessRecordChangeset({ accessedAt: null });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
            @purposes={{PURPOSES}}
            @legalBases={{LEGAL_BASES}}
            @dataCategories={{DATA_CATEGORIES}}
            @sourceSystems={{SOURCE_SYSTEMS}}
            @eligibleAccessors={{ELIGIBLE_ACCESSORS}}
          />
        </template>
      );

      expect(
        document.querySelector('[data-test-access-record-form]')
      ).not.toBeNull();
      // Les champs convertis sont bien des selects power-select, plus des inputs.
      expect(
        document.querySelector(
          '[data-test-tpk-prefab-select-container="accessType"]'
        )
      ).not.toBeNull();
      expect(
        document.querySelector(
          '[data-test-tpk-prefab-select-container="purpose"]'
        )
      ).not.toBeNull();
      expect(
        document.querySelector(
          '[data-test-tpk-prefab-select-container="legalBasis"]'
        )
      ).not.toBeNull();
      expect(
        document.querySelector(
          '[data-test-tpk-prefab-select-container="dataCategories"]'
        )
      ).not.toBeNull();
    }
  );

  renderingTest(
    'Ne soumet pas le formulaire si les champs requis sont vides',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const handleSaveService = context.owner.lookup('service:handle-save');
      const changeset = new AccessRecordChangeset({ accessedAt: null });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
            @purposes={{PURPOSES}}
            @legalBases={{LEGAL_BASES}}
            @dataCategories={{DATA_CATEGORIES}}
            @sourceSystems={{SOURCE_SYSTEMS}}
            @eligibleAccessors={{ELIGIBLE_ACCESSORS}}
          />
        </template>
      );

      await pageObject.submit();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(handleSaveService.handleSave).not.toHaveBeenCalled();
    }
  );

  renderingTest(
    'Sélectionner accessType (Approche A) stocke la valeur brute',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new AccessRecordChangeset({ accessedAt: null });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
            @purposes={{PURPOSES}}
            @legalBases={{LEGAL_BASES}}
            @dataCategories={{DATA_CATEGORIES}}
            @sourceSystems={{SOURCE_SYSTEMS}}
            @eligibleAccessors={{ELIGIBLE_ACCESSORS}}
          />
        </template>
      );

      // Approche A : la valeur affichée EST la valeur stockée (mot français).
      await chooseOption('accessType', 'consultation');

      expect(changeset.get('accessType')).toBe('consultation');
    }
  );

  renderingTest(
    'Sélectionner purpose (référentiel) stocke le code, pas le libellé',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new AccessRecordChangeset({ accessedAt: null });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
            @purposes={{PURPOSES}}
            @legalBases={{LEGAL_BASES}}
            @dataCategories={{DATA_CATEGORIES}}
            @sourceSystems={{SOURCE_SYSTEMS}}
            @eligibleAccessors={{ELIGIBLE_ACCESSORS}}
          />
        </template>
      );

      await chooseOption('purpose', 'Support client');

      expect(changeset.get('purpose')).toBe('support');
    }
  );

  renderingTest(
    'Sélectionner legalBasis (référentiel) stocke le code, pas le libellé',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new AccessRecordChangeset({ accessedAt: null });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
            @purposes={{PURPOSES}}
            @legalBases={{LEGAL_BASES}}
            @dataCategories={{DATA_CATEGORIES}}
            @sourceSystems={{SOURCE_SYSTEMS}}
            @eligibleAccessors={{ELIGIBLE_ACCESSORS}}
          />
        </template>
      );

      // Le libellé affiché vient directement du référentiel (`label`), pas
      // d'une traduction i18n.
      await chooseOption('legalBasis', 'Consentement');

      // Le changeset ne stocke QUE le code stable du référentiel.
      expect(changeset.get('legalBasis')).toBe('consent');
    }
  );

  renderingTest(
    'Sélection multiple de dataCategories produit une chaîne CSV de codes',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new AccessRecordChangeset({ accessedAt: null });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
            @purposes={{PURPOSES}}
            @legalBases={{LEGAL_BASES}}
            @dataCategories={{DATA_CATEGORIES}}
            @sourceSystems={{SOURCE_SYSTEMS}}
            @eligibleAccessors={{ELIGIBLE_ACCESSORS}}
          />
        </template>
      );

      await chooseOption('dataCategories', 'Identification');
      await chooseOption('dataCategories', 'Santé');

      // T3f : multi-select → CSV de slugs (le service le re-splitte en tableau).
      expect(changeset.get('dataCategories')).toBe('identification,health');
    }
  );

  renderingTest(
    'Sélectionner accessorRef stocke le nom affiché (snapshot)',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new AccessRecordChangeset({ accessedAt: null });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
            @purposes={{PURPOSES}}
            @legalBases={{LEGAL_BASES}}
            @dataCategories={{DATA_CATEGORIES}}
            @sourceSystems={{SOURCE_SYSTEMS}}
            @eligibleAccessors={{ELIGIBLE_ACCESSORS}}
          />
        </template>
      );

      await chooseOption('accessorRef', 'Amaury Deflorenne');

      // Décision produit : on stocke le nom affiché, pas un id.
      expect(changeset.get('accessorRef')).toBe('Amaury Deflorenne');
    }
  );

  renderingTest(
    'Sélectionner sourceSystem (référentiel) stocke le code',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new AccessRecordChangeset({ accessedAt: null });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
            @purposes={{PURPOSES}}
            @legalBases={{LEGAL_BASES}}
            @dataCategories={{DATA_CATEGORIES}}
            @sourceSystems={{SOURCE_SYSTEMS}}
            @eligibleAccessors={{ELIGIBLE_ACCESSORS}}
          />
        </template>
      );

      await chooseOption('sourceSystem', 'CRM');

      expect(changeset.get('sourceSystem')).toBe('crm');
    }
  );

  renderingTest(
    'Ajouter un système source le persiste et le sélectionne',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new AccessRecordChangeset({ accessedAt: null });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
            @purposes={{PURPOSES}}
            @legalBases={{LEGAL_BASES}}
            @dataCategories={{DATA_CATEGORIES}}
            @sourceSystems={{SOURCE_SYSTEMS}}
            @eligibleAccessors={{ELIGIBLE_ACCESSORS}}
          />
        </template>
      );

      await pageObject.clickAddSourceSystem();
      await pageObject.fillNewSourceSystem('Nouveau Système');
      await pageObject.clickSaveSourceSystem();

      // Le service (mocké) renvoie le référentiel créé → code sélectionné.
      expect(changeset.get('sourceSystem')).toBe('nouveau-systeme');
    }
  );
});
