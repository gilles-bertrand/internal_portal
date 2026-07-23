import type RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
import TableGenericPrefab, {
  type TableParams,
} from '@triptyk/ember-ui/components/prefabs/tpk-table-generic-prefab';
import type { TableApi } from '@triptyk/ember-ui/components/tpk-table-generic/table';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import TpkConfirmModalPrefab from '@triptyk/ember-ui/components/prefabs/tpk-confirm-modal-prefab';
import TpkSelect from '@triptyk/ember-input/components/tpk-select';
import { on } from '@ember/modifier';
import { t, type IntlService } from 'ember-intl';
import type { TOC } from '@ember/component/template-only';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type CurrentUserService from '@libs/users-front/services/current-user';
import type AbilityService from '@libs/shared-front/services/ability';
import type IncidentExportService from '#src/services/incident-export.ts';
import type IncidentService from '#src/services/incident.ts';
import type { Incident } from '#src/schemas/incidents.ts';
import EditIcon from '#src/assets/icons/edit.gts';
import DeleteIcon from '#src/assets/icons/delete.gts';
import RestoreIcon from '#src/assets/icons/restore.gts';
import { scrollToListTopOnPager } from '#src/utils/scroll-to-top.ts';

type SvgIcon = TOC<{ Element: SVGSVGElement }>;

class IncidentTable extends Component<object> {
  @service declare router: RouterService;
  @service declare intl: IntlService;
  @service declare currentUser: CurrentUserService;
  @service declare ability: AbilityService;
  @service declare incidentExport: IncidentExportService;
  @service declare incident: IncidentService;
  @service declare flashMessages: FlashMessageService;

  @tracked filterStatus = '';
  @tracked filterSpecial = '';
  @tracked exporting = false;
  @tracked showDeleted = false;
  @tracked selectedForDelete: Incident | null = null;

  private tableApi: TableApi | null = null;

  statusFilterOptions = ['open', 'in_progress', 'resolved', 'closed'];
  specialFilterOptions = ['true', 'false'];

  get isEncoder(): boolean {
    return this.currentUser.user?.roleName === 'encoder';
  }

  get canUpdate(): boolean {
    return this.ability.can('update', 'Incident');
  }

  get canDelete(): boolean {
    return this.ability.can('delete', 'Incident');
  }

  // `restore` n'est seedé que pour le DPO → sert aussi de proxy « est DPO ».
  get canRestore(): boolean {
    return this.ability.can('restore', 'Incident');
  }

  get isModalOpen(): boolean {
    return this.selectedForDelete !== null;
  }

  get confirmQuestion(): string {
    return this.intl.t('incidents.table.confirmDelete.question', {
      reference: this.selectedForDelete?.reference ?? '',
    });
  }

  // L'ability front est sans condition de ligne : on garde le row-level ici
  // (le DPO gère tout, l'encoder seulement les siens). Le backend refait foi (403).
  private canManageRow(row: Incident): boolean {
    return this.canRestore || row.encodedBy === this.currentUser.user?.id;
  }

  get additionalFilters(): Record<string, string> {
    const f: Record<string, string> = {};
    if (this.filterStatus) f['status'] = this.filterStatus;
    if (this.filterSpecial) f['specialCategoryData'] = this.filterSpecial;
    if (this.showDeleted && this.canRestore) f['includeDeleted'] = 'true';
    return f;
  }

  get actionMenu(): NonNullable<TableParams['actionMenu']> {
    const actions: NonNullable<TableParams['actionMenu']> = [];
    if (this.canUpdate) {
      actions.push({
        icon: <template><EditIcon class="size-4" /></template> as SvgIcon,
        action: (element: unknown) => this.onEdit(element as Incident),
        name: this.intl.t('incidents.table.actions.edit'),
      });
    }
    if (this.canDelete) {
      actions.push({
        icon: <template><DeleteIcon class="size-4" /></template> as SvgIcon,
        action: (element: unknown) => this.onDelete(element as Incident),
        name: this.intl.t('incidents.table.actions.delete'),
      });
    }
    if (this.canRestore) {
      actions.push({
        icon: <template><RestoreIcon class="size-4" /></template> as SvgIcon,
        action: (element: unknown) => void this.onRestore(element as Incident),
        name: this.intl.t('incidents.table.actions.restore'),
      });
    }
    return actions;
  }

  get tableParams(): TableParams {
    const columns: TableParams['columns'] = [
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
    ];

    // Colonne « état » (tag des lignes supprimées) visible quand le DPO affiche
    // les supprimés — la valeur `deletedAt` marque les incidents soft-supprimés.
    if (this.showDeleted && this.canRestore) {
      columns.push({
        field: 'deletedAt',
        headerName: this.intl.t('incidents.table.headers.state'),
        sortable: false,
      });
    }

    return {
      entity: 'incidents',
      pageSizes: [10, 30, 50],
      defaultSortColumn: '-reportDate',
      additionalFilters: this.additionalFilters,
      registerApi: this.registerApi,
      rowClick: (element) => {
        void this.router.transitionTo(
          'dashboard.incidents.show',
          (element as { id: string }).id
        );
      },
      columns,
      actionMenu: this.actionMenu,
    };
  }

  registerApi = (api: TableApi) => {
    this.tableApi = api;
  };

  private reloadTable(): void {
    this.tableApi?.reloadData();
  }

  onAddIncident = () => {
    void this.router.transitionTo('dashboard.incidents.create');
  };

  onEdit = (row: Incident) => {
    if (!row.id) return;
    if (!this.canManageRow(row)) {
      this.flashMessages.danger(this.intl.t('incidents.table.notAllowed'));
      return;
    }
    void this.router.transitionTo('dashboard.incidents.edit', row.id);
  };

  onDelete = (row: Incident) => {
    if (row.deletedAt) return;
    if (!this.canManageRow(row)) {
      this.flashMessages.danger(this.intl.t('incidents.table.notAllowed'));
      return;
    }
    this.selectedForDelete = row;
  };

  onCloseModal = () => {
    this.selectedForDelete = null;
  };

  onConfirmDelete = async () => {
    const row = this.selectedForDelete;
    if (!row?.id) return;
    try {
      await this.incident.softDelete(row.id);
      this.flashMessages.success(this.intl.t('incidents.table.deleteSuccess'));
      this.reloadTable();
    } catch {
      this.flashMessages.danger(this.intl.t('incidents.table.deleteError'));
    }
    this.onCloseModal();
  };

  onRestore = async (row: Incident) => {
    if (!row.id || !row.deletedAt) return;
    try {
      await this.incident.restore(row.id);
      this.flashMessages.success(this.intl.t('incidents.table.restoreSuccess'));
      this.reloadTable();
    } catch {
      this.flashMessages.danger(this.intl.t('incidents.table.restoreError'));
    }
  };

  onToggleDeleted = () => {
    this.showDeleted = !this.showDeleted;
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

  onChangeStatus = (value: unknown) => {
    this.filterStatus = (value as string | null) ?? '';
  };

  onChangeSpecial = (value: unknown) => {
    this.filterSpecial = (value as string | null) ?? '';
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
          <TpkSelect
            @label={{t "incidents.filters.status"}}
            @options={{this.statusFilterOptions}}
            @selected={{if this.filterStatus this.filterStatus}}
            @onChange={{this.onChangeStatus}}
            @placeholder={{t "incidents.filters.all"}}
            @allowClear={{true}}
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <TpkSelect
            @label={{t "incidents.filters.art9"}}
            @options={{this.specialFilterOptions}}
            @selected={{if this.filterSpecial this.filterSpecial}}
            @onChange={{this.onChangeSpecial}}
            @placeholder={{t "incidents.filters.all"}}
            @allowClear={{true}}
          />
        </label>
        {{#if this.canRestore}}
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              checked={{this.showDeleted}}
              {{on "change" this.onToggleDeleted}}
              data-test-incident-show-deleted
            />
            {{t "incidents.table.showDeleted"}}
          </label>
        {{/if}}
      </div>

      <TableGenericPrefab @tableParams={{this.tableParams}} />

      <TpkConfirmModalPrefab
        @onClose={{this.onCloseModal}}
        @onConfirm={{this.onConfirmDelete}}
        @icon=""
        @cancelText={{t "incidents.table.confirmDelete.cancel"}}
        @confirmText={{t "incidents.table.confirmDelete.confirm"}}
        @confirmQuestion={{this.confirmQuestion}}
        @isOpen={{this.isModalOpen}}
      />
    </div>
  </template>
}

export default IncidentTable;
