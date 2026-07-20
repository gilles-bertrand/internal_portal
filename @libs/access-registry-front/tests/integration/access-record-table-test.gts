import { describe, expect as hardExpect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { click, render } from '@ember/test-helpers';
import AccessRecordTable, {
  SpecialCategoryCell,
} from '#src/components/access-record-table.gts';
import type { AccessRecord } from '#src/schemas/access-records.ts';
import { initializeTestApp, TestApp } from '../app.ts';
import { stubRouter } from '../utils.ts';
import type CurrentUserService from '@libs/users-front/services/current-user';
import type RegistryExportService from '#src/services/registry-export.ts';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';

const sensitiveRow = { isSpecialCategory: true } as unknown as AccessRecord;
const normalRow = { isSpecialCategory: false } as unknown as AccessRecord;

const expect = hardExpect.soft;

describe('access-record-table', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  renderingTest(
    "Affiche le bouton d'export quand l'utilisateur est DPO",
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      // Stub currentUser service avec rôle DPO
      const currentUser = context.owner.lookup(
        'service:current-user'
      ) as CurrentUserService;
      currentUser.user = { roleName: 'dpo' } as CurrentUserService['user'];

      await render(<template><AccessRecordTable /></template>);

      expect(
        document.querySelector('[data-test-export-button]')
      ).not.toBeNull();
    }
  );

  renderingTest(
    "Masque le bouton d'export quand l'utilisateur est encoder",
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const currentUser = context.owner.lookup(
        'service:current-user'
      ) as CurrentUserService;
      currentUser.user = { roleName: 'encoder' } as CurrentUserService['user'];

      await render(<template><AccessRecordTable /></template>);

      expect(document.querySelector('[data-test-export-button]')).toBeNull();
    }
  );

  renderingTest(
    'Appelle registryExport.downloadReport au clic et affiche un flash de succès',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const currentUser = context.owner.lookup(
        'service:current-user'
      ) as CurrentUserService;
      currentUser.user = { roleName: 'dpo' } as CurrentUserService['user'];

      const registryExport = context.owner.lookup(
        'service:registry-export'
      ) as RegistryExportService;
      registryExport.downloadReport = vi.fn().mockResolvedValue(undefined);

      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      flashMessages.success = vi.fn();

      await render(<template><AccessRecordTable /></template>);

      await click('[data-test-export-button]');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(registryExport.downloadReport).toHaveBeenCalledWith('pdf');
      expect(flashMessages.success).toHaveBeenCalled();
    }
  );

  renderingTest(
    "Affiche un flash d'erreur quand l'export échoue",
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const currentUser = context.owner.lookup(
        'service:current-user'
      ) as CurrentUserService;
      currentUser.user = { roleName: 'dpo' } as CurrentUserService['user'];

      const registryExport = context.owner.lookup(
        'service:registry-export'
      ) as RegistryExportService;
      registryExport.downloadReport = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      flashMessages.danger = vi.fn();

      await render(<template><AccessRecordTable /></template>);

      await click('[data-test-export-button]');

      expect(flashMessages.danger).toHaveBeenCalled();
    }
  );

  renderingTest(
    'Affiche les colonnes Accessor reference et Source system',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      await render(<template><AccessRecordTable /></template>);

      // Le harness de lib ne charge pas les traductions : les clés manquantes
      // sont rendues `t:<clé>` — on vérifie donc la présence des colonnes via
      // leur clé i18n (preuve que les colonnes accessorRef/sourceSystem existent).
      const text = document.body.textContent ?? '';
      expect(text).toContain('t:access-records.table.headers.accessorRef');
      expect(text).toContain('t:access-records.table.headers.sourceSystem');
    }
  );

  renderingTest(
    'La cellule sensible affiche une icône pour un enregistrement art. 9',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      await render(
        <template><SpecialCategoryCell @row={{sensitiveRow}} /></template>
      );

      expect(document.querySelector('svg')).not.toBeNull();
    }
  );

  renderingTest(
    "La cellule sensible n'affiche rien pour un enregistrement non sensible",
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      await render(
        <template><SpecialCategoryCell @row={{normalRow}} /></template>
      );

      expect(document.querySelector('svg')).toBeNull();
    }
  );
});
