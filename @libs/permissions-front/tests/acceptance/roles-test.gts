import { visit, currentURL } from '@ember/test-helpers';
import { describe, expect as hardExpect } from 'vitest';
import { applicationTest } from 'ember-vitest';
import { initializeTestApp, TestApp } from '../app.ts';

const expect = hardExpect.soft;

// @lat: [[backend/permissions#Matrice de couverture obligatoire]]
describe('roles route guards (acceptance)', function () {
  // eslint-disable-next-line no-empty-pattern
  applicationTest.override({ app: ({}, use) => use(TestApp) });

  applicationTest(
    '/dashboard/roles redirects a caller without manage:Role to /dashboard',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      // No rules loaded on the ability service — denies everything by
      // default, equivalent to a non-tech_admin caller (e.g. encoder).

      await visit('/dashboard/roles');

      expect(currentURL()).toBe('/dashboard');
    }
  );

  applicationTest(
    '/dashboard/roles/create redirects a caller without manage:Role to /dashboard',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      // No rules loaded — equivalent to a non-tech_admin caller (e.g. dpo).

      await visit('/dashboard/roles/create');

      expect(currentURL()).toBe('/dashboard');
    }
  );

  applicationTest(
    '/dashboard/roles does not redirect a caller with manage:Role away',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'manage', subject: 'Role' }]);

      // La route interroge /api/v1/roles via le store WarpDrive — hors de
      // portée de ce test (pas de mockServiceWorker.js dans ce harnais de
      // lib, et stubber Store#request fidèlement demande de répliquer sa
      // machinerie interne). On ne vérifie donc que la garde de route
      // elle-même : pas de redirection, ce qui est déjà couvert au niveau
      // composant (cf. role-form-test.gts) pour le rendu.
      await visit('/dashboard/roles').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );
});
