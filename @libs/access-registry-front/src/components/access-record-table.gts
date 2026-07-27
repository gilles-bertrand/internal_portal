import type RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import Component from '@glimmer/component';
import TableGenericPrefab, {
  type TableParams,
} from '@triptyk/ember-ui/components/prefabs/tpk-table-generic-prefab';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { fn, hash } from '@ember/helper';
import { on } from '@ember/modifier';
import { t, type IntlService } from 'ember-intl';
import type { TOC } from '@ember/component/template-only';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type CurrentUserService from '@libs/users-front/services/current-user';
import type AbilityService from '@libs/shared-front/services/ability';
import type RegistryExportService from '#src/services/registry-export.ts';
import type SourceSystemService from '#src/services/source-system.ts';
import type ReferentialsService from '#src/services/referentials.ts';
import type { SourceSystem } from '#src/schemas/source-systems.ts';
import type { AccessRecord } from '#src/schemas/access-records.ts';
import { scrollToListTopOnPager } from '#src/utils/scroll-to-top.ts';
import { accessTypeLabelKey } from '#src/utils/access-record-options.ts';
import { localizedLabel } from '#src/utils/referential-label.ts';
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

// @lat: [[frontend/access-record-options#Libellés bilingues résolus côté frontend]]
// Les colonnes purpose / sourceSystem contiennent le CODE du référentiel : sans
// cellule dédiée, le tableau affiche « support » ou « art6.1b ». Deux classes
// nommées plutôt qu'une fabrique : un décorateur `@service` est interdit dans
// une expression de classe (TS1206).
export class PurposeCell extends Component<{
  Args: { row: AccessRecord };
}> {
  @service declare referentials: ReferentialsService;

  get label(): string {
    return this.referentials.purposeLabel(this.args.row.purpose);
  }

  <template>{{this.label}}</template>
}

export class SourceSystemCell extends Component<{
  Args: { row: AccessRecord };
}> {
  @service declare referentials: ReferentialsService;

  get label(): string {
    return this.referentials.sourceSystemLabel(this.args.row.sourceSystem);
  }

  <template>{{this.label}}</template>
}

// accessType n'a pas de référentiel backend : son libellé vient de l'i18n
// frontend, avec repli sur la valeur brute pour un code hors enum courant.
export class AccessTypeCell extends Component<{
  Args: { row: AccessRecord };
}> {
  @service declare intl: IntlService;

  get label(): string {
    const value = this.args.row.accessType;
    if (!value) {
      return '';
    }
    const key = accessTypeLabelKey(value);
    return this.intl.exists(key) ? this.intl.t(key) : value;
  }

  <template>{{this.label}}</template>
}

class AccessRecordTable extends Component<object> {
  @service declare router: RouterService;
  @service declare intl: IntlService;
  @service declare currentUser: CurrentUserService;
  @service declare ability: AbilityService;
  @service declare registryExport: RegistryExportService;
  @service('source-system') declare sourceSystem: SourceSystemService;
  @service declare flashMessages: FlashMessageService;

  @tracked exporting = false;

  // Périmètre de l'export : sentinelle « tous » vs code d'un source system.
  // `undefined` = aucun choix (confirmation bloquée) — pas de défaut implicite.
  readonly ALL_SCOPE = '__all__';
  @tracked scopeModalOpen = false;
  @tracked sourceSystems: SourceSystem[] = [];
  @tracked selectedScope: string | undefined = undefined;

  // Périmètres proposés dans la modale, libellés dans la locale active plutôt
  // que dans la langue de saisie du référentiel.
  get sourceSystemChoices(): { code: string; label: string }[] {
    return this.sourceSystems.map((ss) => ({
      code: ss.code,
      label: localizedLabel(ss, this.intl.primaryLocale),
    }));
  }

  get canConfirmExport(): boolean {
    return this.selectedScope !== undefined;
  }

  get confirmDisabled(): boolean {
    return !this.canConfirmExport;
  }

  get isDpo(): boolean {
    return this.currentUser.user?.roleName === 'dpo';
  }

  // Bouton de création gardé par l'ability (source de vérité unique) : un rôle
  // en lecture seule (ex. tech_admin) ne doit pas le voir. La route create est
  // par ailleurs gardée par requireAbilityOrRedirect('create', 'AccessRecord').
  get canCreate(): boolean {
    return this.ability.can('create', 'AccessRecord');
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
          component: 'accessType',
        },
        {
          field: 'purpose',
          headerName: this.intl.t('access-records.table.headers.purpose'),
          sortable: false,
          component: 'purpose',
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
          component: 'sourceSystem',
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

  // Ouvre la modale de périmètre : on demande à chaque export si l'on veut un
  // source system précis ou l'ensemble du registre (pas de défaut implicite).
  openExportScope = async () => {
    this.sourceSystems = await this.sourceSystem.list();
    this.selectedScope = undefined;
    this.scopeModalOpen = true;
  };

  selectScope = (value: string) => {
    this.selectedScope = value;
  };

  closeExportScope = () => {
    this.scopeModalOpen = false;
  };

  confirmExport = async () => {
    if (this.selectedScope === undefined || this.exporting) return;
    const scope =
      this.selectedScope === this.ALL_SCOPE ? null : this.selectedScope;
    this.exporting = true;
    try {
      await this.registryExport.downloadReport('pdf', scope);
      this.flashMessages.success(this.intl.t('access-records.export.success'));
      this.scopeModalOpen = false;
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
              @onClick={{this.openExportScope}}
              class="btn-primary"
              data-test-export-button
            />
          {{/if}}
          {{#if this.canCreate}}
            <TpkButton
              @label={{t "access-records.table.actions.addRecord"}}
              @onClick={{this.onAddRecord}}
              data-test-add-record-button
            />
          {{/if}}
        </div>
      </div>
      <TableGenericPrefab
        @tableParams={{this.tableParams}}
        @columnsComponent={{hash
          isSpecialCategory=(component SpecialCategoryCell)
          accessType=(component AccessTypeCell)
          purpose=(component PurposeCell)
          sourceSystem=(component SourceSystemCell)
        }}
      />

      {{#if this.scopeModalOpen}}
        <div class="modal modal-open" data-test-export-scope-modal>
          <div class="modal-box">
            <h3 class="text-lg font-semibold mb-4">
              {{t "access-records.export.scope.title"}}
            </h3>
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-scope"
                  class="radio radio-sm"
                  data-test-scope-option="__all__"
                  {{on "change" (fn this.selectScope this.ALL_SCOPE)}}
                />
                {{t "access-records.export.scope.all"}}
              </label>
              {{#each this.sourceSystemChoices as |ss|}}
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="export-scope"
                    class="radio radio-sm"
                    data-test-scope-option={{ss.code}}
                    {{on "change" (fn this.selectScope ss.code)}}
                  />
                  {{ss.label}}
                </label>
              {{/each}}
            </div>
            <div class="modal-action">
              <TpkButton
                @label={{t "access-records.export.scope.cancel"}}
                @onClick={{this.closeExportScope}}
              />
              <button
                type="button"
                class="btn btn-primary"
                disabled={{this.confirmDisabled}}
                {{on "click" this.confirmExport}}
                data-test-export-confirm
              >
                {{t "access-records.export.scope.confirm"}}
              </button>
            </div>
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}

export default AccessRecordTable;
