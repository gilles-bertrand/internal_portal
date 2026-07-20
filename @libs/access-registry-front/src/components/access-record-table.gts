import type RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
import TableGenericPrefab, {
  type TableParams,
} from '@triptyk/ember-ui/components/prefabs/tpk-table-generic-prefab';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { hash } from '@ember/helper';
import { on } from '@ember/modifier';
import { t, type IntlService } from 'ember-intl';
import type { TOC } from '@ember/component/template-only';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type CurrentUserService from '@libs/users-front/services/current-user';
import type RegistryExportService from '#src/services/registry-export.ts';
import type { AccessRecord } from '#src/schemas/access-records.ts';
import { scrollToListTopOnPager } from '#src/utils/scroll-to-top.ts';
import SpecialCategoryIcon from '#src/assets/icons/special-category.gts';
import EyeIcon from '#src/assets/icons/eye.gts';

// Cellule « données sensibles » : affiche une icône bouclier-alerte (amber)
// uniquement pour les enregistrements portant des données de catégorie spéciale
// (art. 9 RGPD), rien sinon.
export class SpecialCategoryCell extends Component<{
  Args: { row: AccessRecord };
}> {
  @service declare intl: IntlService;

  get isSensitive(): boolean {
    return this.args.row.isSpecialCategory === true;
  }

  <template>
    {{#if this.isSensitive}}
      <SpecialCategoryIcon
        class="size-5 text-warning"
        aria-label={{t "access-records.table.sensitiveAria"}}
      />
    {{/if}}
  </template>
}

class AccessRecordTable extends Component<object> {
  @service declare router: RouterService;
  @service declare intl: IntlService;
  @service declare currentUser: CurrentUserService;
  @service declare registryExport: RegistryExportService;
  @service declare flashMessages: FlashMessageService;

  @tracked exporting = false;

  get isDpo(): boolean {
    return this.currentUser.user?.roleName === 'dpo';
  }

  get tableParams(): TableParams {
    return {
      entity: 'access-records',
      pageSizes: [10, 30, 50, 75],
      defaultSortColumn: 'accessedAt',
      rowClick: (element) => {
        this.router.transitionTo(
          'dashboard.access-records.show',
          (element as { id: string }).id
        );
      },
      columns: [
        {
          field: 'accessedAt',
          headerName: this.intl.t('access-records.table.headers.accessedAt'),
          sortable: true,
        },
        {
          field: 'dataSubjectRef',
          headerName: this.intl.t(
            'access-records.table.headers.dataSubjectRef'
          ),
          sortable: false,
        },
        {
          field: 'accessType',
          headerName: this.intl.t('access-records.table.headers.accessType'),
          sortable: false,
        },
        {
          field: 'purpose',
          headerName: this.intl.t('access-records.table.headers.purpose'),
          sortable: false,
        },
        {
          field: 'accessorRef',
          headerName: this.intl.t('access-records.table.headers.accessorRef'),
          sortable: false,
        },
        {
          field: 'sourceSystem',
          headerName: this.intl.t('access-records.table.headers.sourceSystem'),
          sortable: false,
        },
        {
          field: 'isSpecialCategory',
          headerName: this.intl.t(
            'access-records.table.headers.isSpecialCategory'
          ),
          sortable: false,
          component: 'isSpecialCategory',
        },
      ],
      actionMenu: [
        {
          icon: <template><EyeIcon class="size-4" /></template> as TOC<{
            Element: SVGSVGElement;
          }>,
          action: (element: unknown) => {
            this.router.transitionTo(
              'dashboard.access-records.show',
              (element as { id: string }).id
            );
          },
          name: this.intl.t('access-records.table.actions.viewDetails'),
        },
      ],
    };
  }

  onAddRecord = () => {
    this.router.transitionTo('dashboard.access-records.create');
  };

  onExportRegistry = async () => {
    if (this.exporting) return;
    this.exporting = true;
    try {
      await this.registryExport.downloadReport('pdf');
      this.flashMessages.success(this.intl.t('access-records.export.success'));
    } catch {
      this.flashMessages.danger(this.intl.t('access-records.export.error'));
    } finally {
      this.exporting = false;
    }
  };

  <template>
    {{! template-lint-disable no-invalid-interactive }}
    <div {{on "click" scrollToListTopOnPager}}>
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-semibold">
          {{t "access-records.pages.list.title"}}
        </h1>
        <div class="flex items-center gap-2">
          {{#if this.isDpo}}
            <TpkButton
              @label={{if
                this.exporting
                (t "access-records.export.inProgress")
                (t "access-records.actions.exportRegistry")
              }}
              @onClick={{this.onExportRegistry}}
              class="btn-primary"
              data-test-export-button
            />
          {{/if}}
          <TpkButton
            @label={{t "access-records.table.actions.addRecord"}}
            @onClick={{this.onAddRecord}}
          />
        </div>
      </div>
      <TableGenericPrefab
        @tableParams={{this.tableParams}}
        @columnsComponent={{hash
          isSpecialCategory=(component SpecialCategoryCell)
        }}
      />
    </div>
  </template>
}

export default AccessRecordTable;
