import {
  IncidentChangeset,
  incidentToDraft,
} from '#src/changesets/incident.ts';
import IncidentForm from '#src/components/forms/incident-form.gts';
import Component from '@glimmer/component';
import type { IncidentsEditRouteSignature } from './edit.gts';
import type { IntlService } from 'ember-intl';
import { service } from '@ember/service';
import { createIncidentValidationSchema } from '#src/components/forms/incident-validation.ts';
import { t } from 'ember-intl';

export default class IncidentsEditRouteTemplate extends Component<IncidentsEditRouteSignature> {
  @service declare intl: IntlService;

  changeset = new IncidentChangeset(incidentToDraft(this.args.model.incident));

  get validationSchema() {
    return createIncidentValidationSchema(this.intl);
  }

  get incidentId(): string | undefined {
    return this.args.model.incident.id ?? undefined;
  }

  <template>
    <h1 class="text-3xl font-semibold mb-6">{{t
        "incidents.pages.edit.title"
      }}</h1>
    <IncidentForm
      @changeset={{this.changeset}}
      @validationSchema={{this.validationSchema}}
      @mode="edit"
      @incidentId={{this.incidentId}}
    />
  </template>
}
