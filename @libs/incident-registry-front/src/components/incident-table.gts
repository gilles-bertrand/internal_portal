import type RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';
import { cached, tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
import TableGenericPrefab, {
  type TableParams,
} from '@triptyk/ember-ui/components/prefabs/tpk-table-generic-prefab';
import type { TableApi } from '@triptyk/ember-ui/components/tpk-table-generic/table';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import TpkConfirmModalPrefab from '@triptyk/ember-ui/components/prefabs/tpk-confirm-modal-prefab';
import TpkSelect from '@triptyk/ember-input/components/tpk-select';
import { hash } from '@ember/helper';
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
import {
  INCIDENT_STATUSES,
  labelledOption,
  optionLabel,
  statusLabelKey,
  type LabelledOption,
} from '#src/utils/incident-options.ts';

type SvgIcon = TOC<{ Element: SVGSVGElement }>;

// power-select rend la sélection telle qu'on la lui rend : selon le moment,
// c'est l'objet option ou (transitoirement, avant normalisation par nos
// onChange) la chaîne du code. Même garde défensive que
// access-record-form.gts#codeOf.
function codeOf(selected: unknown): string {
  if (typeof selected === 'string') {
    return selected;
  }
  if (selected && typeof selected === 'object' && 'value' in selected) {
    return String(selected.value);
  }
  return '';
}

// @lat: [[frontend/access-record-options#Libellés bilingues résolus côté frontend]]
// TableGenericPrefab passe chaque valeur par `String(value)` : sans cellule
// dédiée, la liste affiche le code brut (`in_progress`), `true`/`false`, une
// date ISO complète et — pire — le texte littéral « null » pour deletedAt.
// Une classe nommée par colonne (et non une fabrique) car un décorateur
// `@service` est interdit dans une expression de classe (TS1206).
export class StatusCell extends Component<{
  Args: { row: Incident };
}> {
  @service declare intl: IntlService;

  get label(): string {
    const value = this.args.row.status;
    return value ? optionLabel(value, statusLabelKey, this.intl) : '';
  }

  <template>
    {{#if this.label}}
      <span class="badge badge-neutral badge-sm">{{this.label}}</span>
    {{/if}}
  </template>
}

// Cellule « données sensibles » (art. 9 RGPD). L'implémentation de référence
// (access-record-table.gts) affiche une icône bouclier-alerte ambre, mais cet
// asset vit dans @libs/access-registry-front dont incident-registry-front NE
// dépend pas : on reste sur des badges DaisyUI plutôt que d'ajouter un couplage
// inter-libs pour une icône.
export class SpecialCategoryCell extends Component<{
  Args: { row: Incident };
}> {
  get isSensitive(): boolean {
    return this.args.row.specialCategoryData === true;
  }

  <template>
    {{#if this.isSensitive}}
      <span class="badge badge-warning badge-sm">{{t
          "incidents.filters.yes"
        }}</span>
    {{else}}
      <span class="text-base-content/60">{{t "incidents.filters.no"}}</span>
    {{/if}}
  </template>
}

// reportDate est stockée en ISO : on la formate dans la locale active plutôt
// que d'afficher « 2026-02-20T00:00:00.000Z » dans la liste.
export class ReportDateCell extends Component<{
  Args: { row: Incident };
}> {
  @service declare intl: IntlService;

  get label(): string {
    const raw = this.args.row.reportDate;
    if (!raw) {
      return '';
    }
    return new Date(raw).toLocaleDateString(this.intl.primaryLocale, {
      dateStyle: 'medium',
    });
  }

  <template>{{this.label}}</template>
}

// Colonne « état » : un badge sur les lignes soft-supprimées, RIEN sinon —
// c'est ce vide qui remplace le « null » littéral affiché jusqu'ici sur toutes
// les lignes vivantes.
export class DeletedStateCell extends Component<{
  Args: { row: Incident };
}> {
  get isDeleted(): boolean {
    return Boolean(this.args.row.deletedAt);
  }

  <template>
    {{#if this.isDeleted}}
      <span class="badge badge-error badge-sm">{{t
          "incidents.table.deletedBadge"
        }}</span>
    {{/if}}
  </template>
}

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

  // Options des filtres : `LabelledOption` (et non le code nu) sinon
  // power-select affiche « in_progress » / « true » dans le menu. `@cached`
  // garantit une identité d'objet stable entre deux rendus, condition pour que
  // `@selected` retrouve bien son option dans `@options`.
  @cached
  get statusFilterOptions(): LabelledOption[] {
    return INCIDENT_STATUSES.map((status) =>
      labelledOption(status, optionLabel(status, statusLabelKey, this.intl))
    );
  }

  // Le filtre backend attend la chaîne « true »/« false » : la valeur reste le
  // code, seul le libellé est traduit.
  @cached
  get specialFilterOptions(): LabelledOption[] {
    return [
      labelledOption('true', this.intl.t('incidents.filters.yes')),
      labelledOption('false', this.intl.t('incidents.filters.no')),
    ];
  }

  get selectedStatusOption(): LabelledOption | undefined {
    return this.statusFilterOptions.find((o) => o.value === this.filterStatus);
  }

  get selectedSpecialOption(): LabelledOption | undefined {
    return this.specialFilterOptions.find(
      (o) => o.value === this.filterSpecial
    );
  }

  // Bouton de création gardé par l'ability (source de vérité unique) plutôt que
  // par `roleName === 'encoder'` : le test sur le rôle masquait le bouton à tout
  // rôle non-encoder autorisé à créer, alors que la route create — gardée par
  // l'ability — le laissait passer.
  get canCreate(): boolean {
    return this.ability.can('create', 'Incident');
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

  // Export du registre COMPLET. Les règles CASL n'ont pas d'action `export`
  // dédiée : côté backend POST /incidents/export ne demande que `read`
  // (export.route.ts), donc on garde sur `read` — et PAS sur le proxy DPO
  // utilisé par access-record-table.gts. L'export d'incidents est ouvert à
  // l'encodeur et à l'auditeur côté serveur : masquer le bouton leur
  // retirerait une capacité réelle, ce qui serait un alignement UX cosmétique
  // au prix d'une régression fonctionnelle.
  get canExportRegistry(): boolean {
    return this.ability.can('read', 'Incident');
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
        component: 'status',
      },
      {
        field: 'reportDate',
        headerName: this.intl.t('incidents.table.headers.reportDate'),
        sortable: true,
        component: 'reportDate',
      },
      {
        field: 'specialCategoryData',
        headerName: this.intl.t('incidents.table.headers.art9'),
        sortable: true,
        component: 'specialCategoryData',
      },
    ];

    // Colonne « état » (tag des lignes supprimées) visible quand le DPO affiche
    // les supprimés — la valeur `deletedAt` marque les incidents soft-supprimés.
    if (this.showDeleted && this.canRestore) {
      columns.push({
        field: 'deletedAt',
        headerName: this.intl.t('incidents.table.headers.state'),
        sortable: false,
        component: 'deletedAt',
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

  // power-select renvoie l'option (ou la chaîne au clear) : on ne stocke que le
  // code, seul format accepté par le filtre backend.
  onChangeStatus = (value: unknown) => {
    this.filterStatus = codeOf(value);
  };

  onChangeSpecial = (value: unknown) => {
    this.filterSpecial = codeOf(value);
  };

  <template>
    {{! template-lint-disable no-invalid-interactive }}
    <div {{on "click" scrollToListTopOnPager}}>
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-semibold">{{t
            "incidents.pages.list.title"
          }}</h1>
        <div class="flex items-center gap-2">
          {{#if this.canExportRegistry}}
            <TpkButton
              @label={{if
                this.exporting
                (t "incidents.export.inProgress")
                (t "incidents.actions.exportRegistry")
              }}
              @onClick={{this.onExportRegistry}}
              class="btn-primary"
              data-test-export-button
            />
          {{/if}}
          {{#if this.canCreate}}
            <TpkButton
              @label={{t "incidents.actions.create"}}
              @onClick={{this.onAddIncident}}
              data-test-add-record-button
            />
          {{/if}}
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-4 my-4">
        {{! Un <div> et non un <label> : TpkSelect rend déjà son propre
        <label for=…> depuis @label — imbriquer les deux faisait annoncer le
        libellé deux fois par les lecteurs d'écran. }}
        <div class="flex flex-col gap-1 text-sm">
          <TpkSelect
            @label={{t "incidents.filters.status"}}
            @options={{this.statusFilterOptions}}
            @selected={{this.selectedStatusOption}}
            @onChange={{this.onChangeStatus}}
            @placeholder={{t "incidents.filters.all"}}
            @allowClear={{true}}
          />
        </div>
        <div class="flex flex-col gap-1 text-sm">
          <TpkSelect
            @label={{t "incidents.filters.art9"}}
            @options={{this.specialFilterOptions}}
            @selected={{this.selectedSpecialOption}}
            @onChange={{this.onChangeSpecial}}
            @placeholder={{t "incidents.filters.all"}}
            @allowClear={{true}}
          />
        </div>
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

      <TableGenericPrefab
        @tableParams={{this.tableParams}}
        @columnsComponent={{hash
          status=(component StatusCell)
          reportDate=(component ReportDateCell)
          specialCategoryData=(component SpecialCategoryCell)
          deletedAt=(component DeletedStateCell)
        }}
      />

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
