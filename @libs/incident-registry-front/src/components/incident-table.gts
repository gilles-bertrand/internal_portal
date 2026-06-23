import type RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
import TableGenericPrefab, {
  type TableParams,
} from '@triptyk/ember-ui/components/prefabs/tpk-table-generic-prefab';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { on } from '@ember/modifier';
import { t, type IntlService } from 'ember-intl';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type CurrentUserService from '@libs/users-front/services/current-user';
import type IncidentExportService from '#src/services/incident-export.ts';
import { scrollToListTopOnPager } from '#src/utils/scroll-to-top.ts';

class IncidentTable extends Component<object> {
  @service declare router: RouterService;
  @service declare intl: IntlService;
  @service declare currentUser: CurrentUserService;
  @service declare incidentExport: IncidentExportService;
  @service declare flashMessages: FlashMessageService;

  @tracked filterStatus = '';
  @tracked filterSpecial = '';
  @tracked exporting = false;

  get isEncoder(): boolean {
    return this.currentUser.user?.role === 'encoder';
  }

  get additionalFilters(): Record<string, string> {
    const f: Record<string, string> = {};
    if (this.filterStatus) f['status'] = this.filterStatus;
    if (this.filterSpecial) f['specialCategoryData'] = this.filterSpecial;
    return f;
  }

  get tableParams(): TableParams {
    return {
      entity: 'incidents',
      pageSizes: [10, 30, 50],
      defaultSortColumn: '-reportDate',
      additionalFilters: this.additionalFilters,
      rowClick: (element) => {
        void this.router.transitionTo(
          'dashboard.incidents.show',
          (element as { id: string }).id
        );
      },
      columns: [
        {
          field: 'reference',
          headerName: this.intl.t('incidents.table.headers.reference'),
          sortable: true,
        },
        {
          field: 'clientName',
          headerName: this.intl.t('incidents.table.headers.client'),
          sortable: true,
        },
        {
          field: 'applicationName',
          headerName: this.intl.t('incidents.table.headers.application'),
          sortable: true,
        },
        {
          field: 'status',
          headerName: this.intl.t('incidents.table.headers.status'),
          sortable: true,
        },
        {
          field: 'reportDate',
          headerName: this.intl.t('incidents.table.headers.reportDate'),
          sortable: true,
        },
        {
          field: 'specialCategoryData',
          headerName: this.intl.t('incidents.table.headers.art9'),
          sortable: true,
        },
      ],
    };
  }

  onAddIncident = () => {
    void this.router.transitionTo('dashboard.incidents.create');
  };

  onExportRegistry = async () => {
    if (this.exporting) return;
    this.exporting = true;
    try {
      await this.incidentExport.downloadRegistryPdf();
      this.flashMessages.success(this.intl.t('incidents.export.success'));
    } catch {
      this.flashMessages.danger(this.intl.t('incidents.export.error'));
    } finally {
      this.exporting = false;
    }
  };

  onChangeStatus = (event: Event) => {
    this.filterStatus = (event.target as HTMLSelectElement).value;
  };

  onChangeSpecial = (event: Event) => {
    this.filterSpecial = (event.target as HTMLSelectElement).value;
  };

  <template>
    {{! template-lint-disable no-invalid-interactive }}
    <div {{on "click" scrollToListTopOnPager}}>
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-semibold">{{t
            "incidents.pages.list.title"
          }}</h1>
        <div class="flex items-center gap-2">
          <TpkButton
            @label={{if
              this.exporting
              (t "incidents.export.inProgress")
              (t "incidents.actions.exportRegistry")
            }}
            @onClick={{this.onExportRegistry}}
            class="btn-primary"
          />
          {{#if this.isEncoder}}
            <TpkButton
              @label={{t "incidents.actions.create"}}
              @onClick={{this.onAddIncident}}
            />
          {{/if}}
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-4 my-4">
        <label class="flex flex-col gap-1 text-sm">
          <span>{{t "incidents.filters.status"}}</span>
          <select
            class="select select-bordered select-sm"
            {{on "change" this.onChangeStatus}}
          >
            <option value="">{{t "incidents.filters.all"}}</option>
            <option value="open">open</option>
            <option value="in_progress">in_progress</option>
            <option value="resolved">resolved</option>
            <option value="closed">closed</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span>{{t "incidents.filters.art9"}}</span>
          <select
            class="select select-bordered select-sm"
            {{on "change" this.onChangeSpecial}}
          >
            <option value="">{{t "incidents.filters.all"}}</option>
            <option value="true">{{t "incidents.filters.yes"}}</option>
            <option value="false">{{t "incidents.filters.no"}}</option>
          </select>
        </label>
      </div>

      <TableGenericPrefab @tableParams={{this.tableParams}} />
    </div>
  </template>
}

export default IncidentTable;
