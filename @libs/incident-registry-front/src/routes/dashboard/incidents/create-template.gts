import { IncidentChangeset } from '#src/changesets/incident.ts';
import IncidentForm from '#src/components/forms/incident-form.gts';
import Component from '@glimmer/component';
import type { IncidentsCreateRouteSignature } from './create.gts';
import type { IntlService } from 'ember-intl';
import { service } from '@ember/service';
import { createIncidentValidationSchema } from '#src/components/forms/incident-validation.ts';
import { t } from 'ember-intl';

function buildDefaultChangeset(): IncidentChangeset {
  const now = new Date().toISOString();
  return new IncidentChangeset({
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
}

export default class IncidentsCreateRouteTemplate extends Component<IncidentsCreateRouteSignature> {
  @service declare intl: IntlService;

  changeset = buildDefaultChangeset();

  get validationSchema() {
    return createIncidentValidationSchema(this.intl);
  }

  <template>
    <h1 class="text-3xl font-semibold mb-6">{{t "incidents.form.title"}}</h1>
    <IncidentForm
      @changeset={{this.changeset}}
      @validationSchema={{this.validationSchema}}
    />
  </template>
}
