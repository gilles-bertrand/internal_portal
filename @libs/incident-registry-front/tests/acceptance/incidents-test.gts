import { visit, currentURL } from '@ember/test-helpers';
import { describe, expect as hardExpect, vi } from 'vitest';
import { applicationTest } from 'ember-vitest';
import { initializeTestApp, TestApp } from '../app.ts';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';

const expect = hardExpect.soft;

// @lat: [[backend/permissions#Matrice de couverture obligatoire]]
describe('incidents route guards (acceptance)', function () {
  // eslint-disable-next-line no-empty-pattern
  applicationTest.override({ app: ({}, use) => use(TestApp) });

  applicationTest(
    '/dashboard/incidents redirects a caller without read:Incident to /dashboard and shows a flash',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      // No rules loaded on the ability service — denies everything by
      // default, equivalent to a caller without DPO/tech_admin rights.
      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      const dangerSpy = vi.spyOn(flashMessages, 'danger');

      await visit('/dashboard/incidents');

      expect(currentURL()).toBe('/dashboard');
      expect(dangerSpy).toHaveBeenCalled();
    }
  );

  applicationTest(
    '/dashboard/incidents/create redirects a caller without create:Incident to /dashboard and shows a flash',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      // No rules loaded — equivalent to a caller who can read but not
      // create incidents.
      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      const dangerSpy = vi.spyOn(flashMessages, 'danger');

      await visit('/dashboard/incidents/create');

      expect(currentURL()).toBe('/dashboard');
      expect(dangerSpy).toHaveBeenCalled();
    }
  );

  applicationTest(
    '/dashboard/incidents/:incident_id redirects a caller without read:Incident to /dashboard and shows a flash',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      const dangerSpy = vi.spyOn(flashMessages, 'danger');

      // beforeModel() aborts the transition before model() runs, so no
      // network request for the incident record is made here.
      await visit('/dashboard/incidents/1');

      expect(currentURL()).toBe('/dashboard');
      expect(dangerSpy).toHaveBeenCalled();
    }
  );

  applicationTest(
    '/dashboard/incidents does not redirect a caller with read:Incident away',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'read', subject: 'Incident' }]);

      // La route interroge le store WarpDrive — hors de portée de ce test
      // (pas de mockServiceWorker.js dans ce harnais de lib). On ne vérifie
      // donc que la garde de route elle-même : pas de redirection.
      await visit('/dashboard/incidents').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );

  applicationTest(
    '/dashboard/incidents/create does not redirect a caller with create:Incident away',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'create', subject: 'Incident' }]);

      await visit('/dashboard/incidents/create').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );

  applicationTest(
    '/dashboard/incidents/:incident_id does not redirect a caller with read:Incident away',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'read', subject: 'Incident' }]);

      // Le model() de cette route interroge l'incident via le store — hors
      // de portée de ce test (pas de mockServiceWorker.js dans ce harnais de
      // lib). On ne vérifie donc que la garde de route elle-même.
      await visit('/dashboard/incidents/1').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );
});
