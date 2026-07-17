import { describe, expect } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { render } from '@ember/test-helpers';
import App from '@apps/front/app';
import DashboardTemplate from '@apps/front/templates/dashboard';
import type CurrentUserService from '@libs/users-front/services/current-user';
import translationsForEnUs from 'virtual:ember-intl/translations/en-us';

// @lat: [[backend/permissions#Sélecteur de rôle réservé à tech_admin]]
describe('Dashboard sidebar menu', () => {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(App) });

  function setup(context: { owner: import('@ember/owner').default }) {
    const intl = context.owner.lookup('service:intl');
    intl.setLocale('en-us');
    intl.addTranslations('en-us', translationsForEnUs);

    const currentUser = context.owner.lookup(
      'service:current-user'
    ) as CurrentUserService;
    currentUser.user = {
      firstName: 'Jane',
      lastName: 'Doe',
    } as CurrentUserService['user'];

    return context.owner.lookup('service:ability');
  }

  renderingTest(
    'hides Users and Roles when the ability grants neither',
    async ({ context }) => {
      setup(context);

      await render(<template><DashboardTemplate /></template>);

      expect(document.body.textContent).toContain('Dashboard');
      expect(document.body.textContent).not.toContain('Users');
      expect(document.body.textContent).not.toContain('Roles');
    }
  );

  renderingTest(
    'shows Users but not Roles when the ability only grants manage:User',
    async ({ context }) => {
      const ability = setup(context);
      ability.load([{ action: 'manage', subject: 'User' }]);

      await render(<template><DashboardTemplate /></template>);

      expect(document.body.textContent).toContain('Users');
      expect(document.body.textContent).not.toContain('Roles');
    }
  );

  renderingTest(
    'shows both Users and Roles when the ability grants manage:User and manage:Role',
    async ({ context }) => {
      const ability = setup(context);
      ability.load([
        { action: 'manage', subject: 'User' },
        { action: 'manage', subject: 'Role' },
      ]);

      await render(<template><DashboardTemplate /></template>);

      expect(document.body.textContent).toContain('Users');
      expect(document.body.textContent).toContain('Roles');
    }
  );

  renderingTest(
    'hides Access registry and Incident registry for a tech_admin ability with no rules on those subjects',
    async ({ context }) => {
      setup(context);

      await render(<template><DashboardTemplate /></template>);

      expect(document.body.textContent).not.toContain('Access registry');
      expect(document.body.textContent).not.toContain('Incident registry');
    }
  );

  renderingTest(
    'shows Access registry and Incident registry for an encoder ability',
    async ({ context }) => {
      const ability = setup(context);
      ability.load([
        { action: 'create', subject: 'AccessRecord' },
        {
          action: 'read',
          subject: 'AccessRecord',
          conditions: { encodedBy: '$user.id' },
        },
        { action: 'create', subject: 'Incident' },
        {
          action: 'read',
          subject: 'Incident',
          conditions: { encodedBy: '$user.id' },
        },
      ]);

      await render(<template><DashboardTemplate /></template>);

      expect(document.body.textContent).toContain('Access registry');
      expect(document.body.textContent).toContain('Incident registry');
    }
  );
});
