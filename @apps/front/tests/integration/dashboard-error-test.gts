import { describe, expect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { render } from '@ember/test-helpers';
import App from '@apps/front/app';
import DashboardErrorTemplate from '@apps/front/templates/dashboard/error';
import translationsForEnUs from 'virtual:ember-intl/translations/en-us';

vi.mock('@embroider/config-meta-loader', () => {
  return {
    default: vi.fn(() => {
      return {
        modulePrefix: '@apps/front',
        environment: 'test',
        rootURL: '/',
        locationType: 'history',
        EmberENV: {
          EXTEND_PROTOTYPES: false,
          FEATURES: {},
        },
        APP: {},
      };
    }),
  };
});

// @lat: [[frontend/shared-front#Substate d'erreur dashboard/error]]
describe('Dashboard error substate', () => {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(App) });

  renderingTest(
    'shows "access denied" and a way back for a 403 error',
    async ({ context }) => {
      const intl = context.owner.lookup('service:intl');
      intl.setLocale('en-us');
      intl.addTranslations('en-us', translationsForEnUs);

      const model = new AggregateError(
        [
          {
            status: '403',
            code: 'FORBIDDEN',
            detail: 'Insufficient permission',
          },
        ],
        'Forbidden'
      );

      await render(
        <template><DashboardErrorTemplate @model={{model}} /></template>
      );

      const el = document.querySelector('[data-test-dashboard-error]');
      expect(el).not.toBeNull();
      expect(el?.textContent).toContain('Access denied');
      expect(el?.textContent).toContain(
        'You do not have permission to perform this action.'
      );
    }
  );

  renderingTest('shows "not found" for a 404 error', async ({ context }) => {
    const intl = context.owner.lookup('service:intl');
    intl.setLocale('en-us');
    intl.addTranslations('en-us', translationsForEnUs);

    const model = new AggregateError(
      [
        {
          status: '404',
          code: 'USER_NOT_FOUND',
          detail: 'User with id x not found',
        },
      ],
      'Not Found'
    );

    await render(
      <template><DashboardErrorTemplate @model={{model}} /></template>
    );

    const el = document.querySelector('[data-test-dashboard-error]');
    expect(el?.textContent).toContain('Resource not found');
  });

  renderingTest(
    'falls back to a generic message for a non-JSON:API error',
    async ({ context }) => {
      const intl = context.owner.lookup('service:intl');
      intl.setLocale('en-us');
      intl.addTranslations('en-us', translationsForEnUs);

      const model = new Error('Network error');

      await render(
        <template><DashboardErrorTemplate @model={{model}} /></template>
      );

      const el = document.querySelector('[data-test-dashboard-error]');
      expect(el?.textContent).toContain('An error occurred');
      expect(el?.textContent).toContain('An error occurred. Please try again.');
    }
  );
});
