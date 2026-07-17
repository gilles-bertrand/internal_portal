import { describe, expect, vi } from 'vitest';
import { applicationTest } from 'ember-vitest';
import { visit } from '@ember/test-helpers';
import App from '@apps/front/app';

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

describe('Translations', () => {
  // eslint-disable-next-line no-empty-pattern
  applicationTest.override({ app: ({}, use) => use(App) });

  // @lat: [[frontend/shared-front#Priorité de résolution du message (erreurs globales)]]
  applicationTest(
    'shared.handle-save.* namespace is registered and resolvable',
    async ({ context }) => {
      // ApplicationRoute#beforeModel is what registers translations
      // (this.intl.addTranslations(...)) — a route visit is required, a
      // bare service lookup runs before that hook fires.
      await visit('/login');
      const intl = context.owner.lookup('service:intl');

      expect(intl.exists('shared.handle-save.generic-error-message')).toBe(
        true
      );
      expect(intl.exists('shared.handle-save.errors.FORBIDDEN')).toBe(true);
      expect(intl.exists('shared.handle-save.status.409')).toBe(true);
    }
  );
});
