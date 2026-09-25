import { visit, currentURL } from '@ember/test-helpers';
import { describe, expect as hardExpect, vi } from 'vitest';
import { applicationTest } from 'ember-vitest';
import { initializeTestApp, TestApp } from '../app.ts';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';

const expect = hardExpect.soft;

// @lat: [[backend/permissions#Matrice de couverture obligatoire]]
describe('access records route guards (acceptance)', function () {
  // eslint-disable-next-line no-empty-pattern
  applicationTest.override({ app: ({}, use) => use(TestApp) });

  applicationTest(
    '/dashboard/access-records redirects a caller without read:AccessRecord to /dashboard and shows a flash',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      // No rules loaded on the ability service — denies everything by
      // default, equivalent to a caller without DPO/tech_admin rights.
      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      const dangerSpy = vi.spyOn(flashMessages, 'danger');

      await visit('/dashboard/access-records');

      expect(currentURL()).toBe('/dashboard');
      expect(dangerSpy).toHaveBeenCalled();
    }
  );

  applicationTest(
    '/dashboard/access-records/create redirects a caller without create:AccessRecord to /dashboard and shows a flash',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      // No rules loaded — equivalent to a caller who can read but not
      // create access records.
      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      const dangerSpy = vi.spyOn(flashMessages, 'danger');

      await visit('/dashboard/access-records/create');

      expect(currentURL()).toBe('/dashboard');
      expect(dangerSpy).toHaveBeenCalled();
    }
  );

  applicationTest(
    '/dashboard/audit-events redirects a caller without read:AccessRecord to /dashboard and shows a flash',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      const dangerSpy = vi.spyOn(flashMessages, 'danger');

      await visit('/dashboard/audit-events');

      expect(currentURL()).toBe('/dashboard');
      expect(dangerSpy).toHaveBeenCalled();
    }
  );

  applicationTest(
    '/dashboard/access-records does not redirect a caller with read:AccessRecord away',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'read', subject: 'AccessRecord' }]);

      // La route interroge le store WarpDrive — hors de portée de ce test
      // (pas de mockServiceWorker.js dans ce harnais de lib). On ne vérifie
      // donc que la garde de route elle-même : pas de redirection.
      await visit('/dashboard/access-records').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );

  applicationTest(
    '/dashboard/access-records/create does not redirect a caller with create:AccessRecord away',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'create', subject: 'AccessRecord' }]);

      // Le model() de cette route interroge purposes/legal-bases/data-categories
      // via le store — hors de portée de ce test (pas de mockServiceWorker.js
      // dans ce harnais de lib). On ne vérifie donc que la garde de route.
      await visit('/dashboard/access-records/create').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );

  // Le journal d'audit est transverse depuis qu'il a quitté ce registre : son
  // garde est `read AuditEvent`, aligné sur le backend, et non plus
  // `read AccessRecord`. Voir [[backend/audit-log#Journal exposé par son propre module]].
  applicationTest(
    '/dashboard/audit-events does not redirect a caller with read:AuditEvent away',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'read', subject: 'AuditEvent' }]);

      await visit('/dashboard/audit-events').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );

  // Et la contrepartie : lire le registre d'accès ne donne plus le journal, qui
  // contient les événements de TOUS les domaines.
  applicationTest(
    '/dashboard/audit-events redirects a caller with only read:AccessRecord',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'read', subject: 'AccessRecord' }]);

      await visit('/dashboard/audit-events').catch(() => undefined);

      expect(currentURL()).toBe('/dashboard');
    }
  );

  applicationTest(
    '/dashboard/access-records/:id redirects a caller without read:AccessRecord to /dashboard and shows a flash',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const flashMessages = context.owner.lookup(
        'service:flash-messages'
      ) as FlashMessageService;
      const dangerSpy = vi.spyOn(flashMessages, 'danger');

      await visit('/dashboard/access-records/1');

      expect(currentURL()).toBe('/dashboard');
      expect(dangerSpy).toHaveBeenCalled();
    }
  );

  applicationTest(
    '/dashboard/access-records/:id does not redirect a caller with read:AccessRecord away',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const ability = context.owner.lookup('service:ability');
      ability.load([{ action: 'read', subject: 'AccessRecord' }]);

      // La route interroge le store WarpDrive (findRecord) — hors de portée de
      // ce test (pas de mockServiceWorker.js dans ce harnais). On ne vérifie
      // donc que la garde de route : pas de redirection.
      await visit('/dashboard/access-records/1').catch(() => undefined);

      expect(currentURL()).not.toBe('/dashboard');
    }
  );
});
