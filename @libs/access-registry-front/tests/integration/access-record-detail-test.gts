import { describe, expect as hardExpect } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { render } from '@ember/test-helpers';
import AccessRecordDetail from '#src/components/access-record-detail.gts';
import type { AccessRecord } from '#src/schemas/access-records.ts';
import { initializeTestApp, TestApp } from '../app.ts';
import { stubRouter } from '../utils.ts';
import type Owner from '@ember/owner';
import type ReferentialsService from '#src/services/referentials.ts';

const expect = hardExpect.soft;

const baseRecord = {
  id: '2',
  accessedAt: '2026-06-11T14:00:00.000Z',
  encodedAt: '2026-06-11T14:02:00.000Z',
  encodedBy: 'encoder-2',
  encodedByName: 'Camille DPO',
  accessorRef: 'Amaury Deflorenne',
  dataSubjectRef: 'cust-pseudonym-117',
  dataCategories: ['santé'],
  isSpecialCategory: true,
  accessType: 'transmission',
  purpose: 'remboursement',
  legalBasis: 'art9.2h',
  sourceSystem: 'dossier-medical',
  recipient: 'Mutuelle X',
  justification: 'Transmission pour remboursement',
  retentionUntil: '2036-06-11T14:00:00.000Z',
  seq: 2,
  prevHash: '0'.repeat(64),
  hash: 'a'.repeat(64),
} as unknown as AccessRecord;

// Le record ne stocke que des codes de référentiels : les tests qui vérifient
// l'affichage des libellés doivent peupler le cache du service, normalement
// alimenté par la route.
function seedReferentials(owner: Owner) {
  const referentials = owner.lookup('service:referentials');
  referentials.purposes = [
    { code: 'remboursement', label: 'Remboursement', labelEn: 'Reimbursement' },
  ] as unknown as ReferentialsService['purposes'];
  referentials.legalBases = [
    {
      code: 'art9.2h',
      label: 'Médecine préventive (art. 9.2.h)',
      labelEn: 'Preventive medicine (art. 9.2.h)',
    },
  ] as unknown as ReferentialsService['legalBases'];
  referentials.dataCategories = [
    { code: 'health', label: 'Santé', labelEn: 'Health' },
  ] as unknown as ReferentialsService['dataCategories'];
  referentials.sourceSystems = [
    { code: 'dossier-medical', label: 'Dossier médical', labelEn: null },
  ] as unknown as ReferentialsService['sourceSystems'];
  return referentials;
}

describe('access-record-detail', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  renderingTest(
    'Affiche les champs clés en lecture seule',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const record = baseRecord;
      await render(
        <template><AccessRecordDetail @record={{record}} /></template>
      );

      const text = document.body.textContent ?? '';
      expect(text).toContain('Amaury Deflorenne');
      expect(text).toContain('cust-pseudonym-117');
      // Référentiels non chargés : le code persisté reste affiché plutôt que de
      // laisser un champ vide.
      expect(text).toContain('dossier-medical');
      expect(text).toContain('Transmission pour remboursement');
      // « Encodé par » affiche le nom résolu, pas l'UUID.
      expect(text).toContain('Camille DPO');

      // Lecture seule : aucun champ de saisie.
      expect(document.querySelector('input, textarea, select')).toBeNull();
      expect(
        document.querySelector('[data-test-access-record-detail]')
      ).not.toBeNull();
    }
  );

  renderingTest(
    'Affiche le badge « données sensibles » pour un enregistrement art. 9',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const record = baseRecord;
      await render(
        <template><AccessRecordDetail @record={{record}} /></template>
      );

      expect(
        document.querySelector('[data-test-detail-sensitive]')
      ).not.toBeNull();
    }
  );

  renderingTest(
    "N'affiche pas le badge sensible pour un enregistrement non sensible",
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const record = {
        ...baseRecord,
        isSpecialCategory: false,
      } as unknown as AccessRecord;
      await render(
        <template><AccessRecordDetail @record={{record}} /></template>
      );

      expect(document.querySelector('[data-test-detail-sensitive]')).toBeNull();
    }
  );
  renderingTest(
    'Affiche les libellés des référentiels, pas les codes persistés',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);
      seedReferentials(context.owner);

      const record = baseRecord;
      await render(
        <template><AccessRecordDetail @record={{record}} /></template>
      );

      const text = document.body.textContent ?? '';
      expect(text).toContain('Dossier médical');
      expect(text).toContain('Médecine préventive (art. 9.2.h)');
      expect(text).toContain('Remboursement');
      expect(text).not.toContain('dossier-medical');
    }
  );
  renderingTest(
    'Rend les libellés anglais en locale anglaise, avec repli sur le français',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      stubRouter(context.owner);
      seedReferentials(context.owner);

      const record = baseRecord;
      await render(
        <template><AccessRecordDetail @record={{record}} /></template>
      );

      const text = document.body.textContent ?? '';
      expect(text).toContain('Preventive medicine (art. 9.2.h)');
      expect(text).toContain('Reimbursement');
      // labelEn absent pour ce système source : le libellé français subsiste
      // plutôt qu'un champ vide.
      expect(text).toContain('Dossier médical');
    }
  );
});
