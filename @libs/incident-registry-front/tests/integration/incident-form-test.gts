import { describe, expect as hardExpect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { render } from '@ember/test-helpers';
import { IncidentChangeset } from '#src/changesets/incident.ts';
import IncidentForm from '#src/components/forms/incident-form.gts';
import { initializeTestApp, TestApp } from '../app.ts';
import { stubRouter } from '../utils.ts';
import { createIncidentValidationSchema } from '#src/components/forms/incident-validation.ts';

const expect = hardExpect.soft;

vi.mock('@libs/shared-front/services/handle-save', async () => {
  const { default: EmberService } = await import('@ember/service');
  return {
    default: class MockHandleSaveService extends EmberService {
      handleSave = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe('incident-form', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  renderingTest(
    'Rend le formulaire multi-étapes',
    async function ({ context }) {
      initializeTestApp(context.owner, 'fr-fr');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const now = new Date().toISOString();
      const changeset = new IncidentChangeset({
        version: '1.0',
        classification: 'CONFIDENTIEL',
        status: 'open',
        environment: 'production',
        personalDataImpacted: false,
        specialCategoryData: false,
        apdNotificationRequired: false,
        reportDate: now,
        recipientName: '',
        recipientOrg: '',
        deployedVersion: '1.0',
        incidentStartAt: now,
        detectedAt: now,
        contributingFactors: [],
        correctiveActions: [],
        preventiveMeasures: [],
        timelineEvents: [],
        descriptionSections: [],
        accessLogs: [],
        issuerSignature: { name: '', date: '' },
        recipientSignature: { name: '', date: '' },
      });
      const validationSchema = createIncidentValidationSchema(intl);

      await render(
        <template>
          <IncidentForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
          />
        </template>
      );

      expect(
        document.querySelector('[data-test-incident-form]')
      ).not.toBeNull();
      expect(
        document.querySelector('[data-test-incident-next]')
      ).not.toBeNull();
    }
  );
});
