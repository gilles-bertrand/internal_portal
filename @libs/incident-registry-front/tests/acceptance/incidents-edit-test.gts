import { visit, currentURL } from '@ember/test-helpers';
import { describe, expect as hardExpect, vi } from 'vitest';
import { applicationTest } from 'ember-vitest';
import { initializeTestApp, TestApp } from '../app.ts';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';

const expect = hardExpect.soft;

// @lat: [[backend/permissions#Matrice de couverture obligatoire]]
describe('incidents edit route guard (acceptance)', function () {
  // eslint-disable-next-line no-empty-pattern
  applicationTest.override({ app: ({}, use) => use(TestApp) });

  applicationTest(
    '/dashboard/incidents/:id/edit redirects a caller without update:Incident to /dashboard and shows a flash',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      // Aucune règle chargée → tout refusé (équivalent auditor/absence de droit).
      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      const dangerSpy = vi.spyOn(flashMessages, 'danger');

      // beforeModel() interrompt la transition avant model() → aucune requête.
      await visit('/dashboard/incidents/1/edit');

      expect(currentURL()).toBe('/dashboard');
      expect(dangerSpy).toHaveBeenCalled();
    }
  );

  applicationTest(
    '/dashboard/incidents/:id/edit does not redirect a caller with update:Incident away',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'update', subject: 'Incident' }]);

      // Le model() interroge l'incident via le store — hors de portée de ce
      // harnais de lib (pas de mockServiceWorker.js). On ne vérifie que la garde.
      await visit('/dashboard/incidents/1/edit').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );
});
