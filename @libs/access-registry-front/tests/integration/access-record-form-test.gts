import { describe, expect as hardExpect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { render } from '@ember/test-helpers';
import { AccessRecordChangeset } from '#src/changesets/access-record.ts';
import AccessRecordForm, {
  pageObject,
} from '#src/components/forms/access-record-form.gts';
import { initializeTestApp, TestApp } from '../app.ts';
import { stubRouter } from '../utils.ts';
import { createAccessRecordValidationSchema } from '#src/components/forms/access-record-validation.ts';

const expect = hardExpect.soft;

// Stub minimal de HandleSaveService — on évite d'étendre la vraie classe
// pour ne pas déclencher les injections (@service) non enregistrées en test
// (ErrorReporterService notamment).
vi.mock('@libs/shared-front/services/handle-save', async () => {
  const { default: EmberService } = await import('@ember/service');
  return {
    default: class MockHandleSaveService extends EmberService {
      handleSave = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe('access-record-form', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  renderingTest(
    'Rend le formulaire avec son attribut data-test',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new AccessRecordChangeset({ accessedAt: undefined });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
          />
        </template>
      );

      expect(
        document.querySelector('[data-test-access-record-form]')
      ).not.toBeNull();
    }
  );

  renderingTest(
    'Ne soumet pas le formulaire si les champs requis sont vides',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const handleSaveService = context.owner.lookup('service:handle-save');
      const changeset = new AccessRecordChangeset({ accessedAt: undefined });
      const validationSchema = createAccessRecordValidationSchema(intl);

      await render(
        <template>
          <AccessRecordForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
          />
        </template>
      );

      await pageObject.submit();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(handleSaveService.handleSave).not.toHaveBeenCalled();
    }
  );
});
