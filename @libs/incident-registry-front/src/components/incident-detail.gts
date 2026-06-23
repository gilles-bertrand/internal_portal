import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { t, type IntlService } from 'ember-intl';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type { Incident } from '#src/schemas/incidents.ts';
import type IncidentExportService from '#src/services/incident-export.ts';

interface IncidentDetailArgs {
  incident: Incident;
}

export default class IncidentDetail extends Component<IncidentDetailArgs> {
  @service declare incidentExport: IncidentExportService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  @tracked exporting = false;

  @action
  async exportPdf() {
    if (this.exporting) return;
    this.exporting = true;
    try {
      await this.incidentExport.downloadIncidentPdf(this.args.incident.id!);
    } catch {
      this.flashMessages.danger(this.intl.t('incidents.export.error'));
    } finally {
      this.exporting = false;
    }
  }

  <template>
    <div class="max-w-4xl space-y-4">
      <header class="flex justify-between items-start gap-4">
        <div>
          <h1 class="text-2xl font-bold">{{@incident.reference}}</h1>
          <p class="text-muted">{{@incident.clientName}}
            —
            {{@incident.applicationName}}</p>
        </div>
        <TpkButton
          @label={{t "incidents.actions.exportReport"}}
          @onClick={{this.exportPdf}}
          @disabled={{this.exporting}}
        />
      </header>

      <section>
        <h2 class="font-semibold">{{t "incidents.detail.legal"}}</h2>
        <p>{{@incident.legalContext}}</p>
      </section>

      <section>
        <h2 class="font-semibold">{{t "incidents.detail.description"}}</h2>
        <p>{{@incident.description}}</p>
      </section>

      <section>
        <h2 class="font-semibold">{{t "incidents.detail.impact"}}</h2>
        <p>{{@incident.impactSummary}}</p>
      </section>

      <section>
        <h2 class="font-semibold">{{t "incidents.detail.conclusion"}}</h2>
        <p>{{@incident.conclusion}}</p>
      </section>
    </div>
  </template>
}
