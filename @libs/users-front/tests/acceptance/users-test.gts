import { visit, currentURL } from '@ember/test-helpers';
import { describe, expect as hardExpect, vi } from 'vitest';
import { applicationTest } from 'ember-vitest';
import { initializeTestApp, TestApp } from '../app.ts';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';

const expect = hardExpect.soft;

// @lat: [[backend/permissions#Matrice de couverture obligatoire]]
describe('users route guards (acceptance)', function () {
  // eslint-disable-next-line no-empty-pattern
  applicationTest.override({ app: ({}, use) => use(TestApp) });

  applicationTest(
    '/dashboard/users redirects a caller without manage:User to /dashboard and shows a flash',
    async function ({ context }) {
      await initializeTestApp(context.owner, 'en-us');
      // No rules loaded on the ability service — denies everything by
      // default, equivalent to a non-tech_admin caller (e.g. encoder).
      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      const dangerSpy = vi.spyOn(flashMessages, 'danger');

      await visit('/dashboard/users');

      expect(currentURL()).toBe('/dashboard');
      expect(dangerSpy).toHaveBeenCalled();
    }
  );

  applicationTest(
    '/dashboard/users/create redirects a caller without manage:User to /dashboard',
    async function ({ context }) {
      await initializeTestApp(context.owner, 'en-us');

      await visit('/dashboard/users/create');

      expect(currentURL()).toBe('/dashboard');
    }
  );

  applicationTest(
    '/dashboard/users does not redirect a caller with manage:User away',
    async function ({ context }) {
      await initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'manage', subject: 'User' }]);

      // La route interroge /api/v1/users via le store WarpDrive — hors de
      // portée de ce test (pas de mockServiceWorker.js dans ce harnais de
      // lib). On ne vérifie donc que la garde de route elle-même : pas de
      // redirection, ce qui est déjà couvert au niveau composant pour le
      // rendu (user-form-test.gts).
      await visit('/dashboard/users').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );
});
