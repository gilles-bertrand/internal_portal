import Component from '@glimmer/component';
import { cached, tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import type { ComponentLike } from '@glint/template';
import TpkForm from '@triptyk/ember-input-validation/components/tpk-form';
import { service } from '@ember/service';
import type AccessRecordService from '#src/services/access-record.ts';
import type SourceSystemService from '#src/services/source-system.ts';
import type { AccessRecordChangeset } from '#src/changesets/access-record.ts';
import {
  createAccessRecordValidationSchema,
  type ValidatedAccessRecord,
} from '#src/components/forms/access-record-validation.ts';
import type RouterService from '@ember/routing/router-service';
import { create, fillable, clickable } from 'ember-cli-page-object';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import { t, type IntlService } from 'ember-intl';
import { LinkTo } from '@ember/routing';
import type ImmerChangeset from 'ember-immer-changeset';
import HandleSaveService from '@libs/shared-front/services/handle-save';
import ArrowLeftIcon from '@libs/shared-front/assets/icons/arrow-left';
import { ACCESS_TYPES } from '#src/utils/access-record-options.ts';
import type { Purpose } from '#src/schemas/purposes.ts';
import type { LegalBasis } from '#src/schemas/legal-bases.ts';
import type { DataCategory } from '#src/schemas/data-categories.ts';
import type { SourceSystem } from '#src/schemas/source-systems.ts';
import type { EligibleAccessor } from '#src/schemas/eligible-accessors.ts';

interface AccessRecordFormArgs {
  changeset: AccessRecordChangeset;
  validationSchema: ReturnType<typeof createAccessRecordValidationSchema>;
  purposes: Purpose[];
  legalBases: LegalBasis[];
  dataCategories: DataCategory[];
  sourceSystems: SourceSystem[];
  eligibleAccessors: EligibleAccessor[];
}

// @lat: [[frontend/access-record-options#Référentiels dynamiques vs enum statique]]
// Option shape for the referential-backed selects (legalBasis, dataCategories,
// purpose): `value` is the stable `code` returned by the backend referential,
// `label` its display text (already resolved server-side — no i18n needed,
// unlike the Approach-B slugs used previously). The custom `toString` is
// required because TpkValidationSelectPrefab renders each option via
// `String(option)`.
interface ReferentialOption {
  value: string;
  label: string;
  toString(): string;
}

function referentialOption(value: string, label: string): ReferentialOption {
  return { value, label, toString: () => label };
}

// power-select passes the selected item as `unknown`; it may be the stored
// code string or (transiently, before our onChange normalises it) the option
// object.
function codeOf(selected: unknown): string {
  if (typeof selected === 'string') {
    return selected;
  }
  if (selected && typeof selected === 'object' && 'value' in selected) {
    return String(selected.value);
  }
  return '';
}

interface SelectedItemSignature {
  Args: {
    selected: unknown;
    extra?: unknown;
  };
  Blocks: { default: [] };
  Element: HTMLElement;
}

// Renders the trigger (selected item) label for the referential-backed
// selects. The changeset only stores the code, so the trigger resolves its
// label from the currently loaded options list, passed in by reference so it
// always reflects the latest fetch.
//
// Explicit ComponentLike<...> return type required: ember-tsc's declaration
// build (`--declaration`, used by the workspace build/dev pipeline) cannot
// name the anonymous class type inferred from a bare class expression here
// (TS2883/TS4041 — internal Glint integration types leak into the inferred
// signature). `lint:types` (`--noEmit`) does not emit declarations, so it
// doesn't catch this; only `pnpm build`/`pnpm dev` (build:watch) does.
function selectedOptionComponent(
  getOptions: () => ReferentialOption[]
): ComponentLike<SelectedItemSignature> {
  return class extends Component<SelectedItemSignature> {
    get label(): string {
      const code = codeOf(this.args.selected);
      return code
        ? (getOptions().find((o) => o.value === code)?.label ?? '')
        : '';
    }
    <template>
      <span ...attributes>{{this.label}}{{yield}}</span>
    </template>
  };
}

export default class AccessRecordForm extends Component<AccessRecordFormArgs> {
  @service declare accessRecord: AccessRecordService;
  @service('source-system') declare sourceSystem: SourceSystemService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;
  @service declare handleSave: HandleSaveService;

  // Systèmes sources ajoutés à la volée via l'affordance « + Ajouter », fusionnés
  // aux référentiels chargés depuis le backend (@sourceSystems).
  @tracked addedSourceSystems: ReferentialOption[] = [];
  @tracked isAddingSourceSystem = false;
  @tracked newSourceSystemLabel = '';
  @tracked sourceSystemSaving = false;

  onSubmit = async (
    data: ValidatedAccessRecord,
    c: ImmerChangeset<ValidatedAccessRecord>
  ) => {
    await this.handleSave.handleSave({
      saveAction: () => this.accessRecord.create(data),
      changeset: c,
      successMessage: 'access-records.forms.accessRecord.messages.saveSuccess',
      transitionOnSuccess: 'dashboard.access-records',
    });
  };

  // @lat: [[frontend/forms#Stocker un Date, pas une string, pendant l'édition]]
  // Store the raw Date (not an ISO string): TpkDatepickerPrefab re-feeds this
  // value to tempus-dominus on every re-render, and a string forces it back
  // through DateTime.fromString (crash-prone, and always logs "TD: Using a
  // string for date options..."). access-record-validation.ts converts to
  // ISO for the actual submitted payload.
  setAccessedAt = (dates: Date[]) => {
    // Cast: DraftAccessRecord declares `string | null` (to satisfy TpkForm's
    // changeset<->schema type coupling), but the actual runtime value stored
    // here is a Date — see the @lat note above.
    this.args.changeset.set(
      'accessedAt',
      (dates[0] ?? null) as unknown as string | null
    );
  };

  // accessType — Approach A: value = displayed label (already French words),
  // so plain string options are passed straight through (like the sister
  // incident-form). The prefab stores the selected string in the changeset.
  // No backend referential exists for this field (unlike purpose/legalBasis/
  // dataCategories), so it stays a static frontend enum.
  get accessTypeOptions(): string[] {
    return [...ACCESS_TYPES];
  }

  @cached
  get purposeOptions(): ReferentialOption[] {
    return this.args.purposes.map((p) => referentialOption(p.code, p.label));
  }

  @cached
  get purposeSelectedItemComponent(): ComponentLike<SelectedItemSignature> {
    return selectedOptionComponent(() => this.purposeOptions);
  }

  setPurpose = (option: unknown) => {
    const value = (option as ReferentialOption | null)?.value;
    this.args.changeset.set('purpose', value);
  };

  @cached
  get legalBasisOptions(): ReferentialOption[] {
    return this.args.legalBases.map((b) => referentialOption(b.code, b.label));
  }

  @cached
  get legalBasisSelectedItemComponent(): ComponentLike<SelectedItemSignature> {
    return selectedOptionComponent(() => this.legalBasisOptions);
  }

  setLegalBasis = (option: unknown) => {
    const value = (option as ReferentialOption | null)?.value;
    this.args.changeset.set('legalBasis', value);
  };

  @cached
  get dataCategoryOptions(): ReferentialOption[] {
    return this.args.dataCategories.map((c) =>
      referentialOption(c.code, c.label)
    );
  }

  @cached
  get dataCategorySelectedItemComponent(): ComponentLike<SelectedItemSignature> {
    return selectedOptionComponent(() => this.dataCategoryOptions);
  }

  // accessorRef — select des utilisateurs habilités à créer un record (chargés
  // depuis /eligible-accessors). Approche A : la valeur stockée EST le nom
  // affiché (snapshot), donc options string simples, comme accessType.
  get accessorOptions(): string[] {
    return this.args.eligibleAccessors.map((accessor) => accessor.name);
  }

  // sourceSystem — référentiel backend (comme purpose/legalBasis) MAIS creatable :
  // les systèmes ajoutés via « + Ajouter » sont fusionnés aux options chargées.
  get sourceSystemOptions(): ReferentialOption[] {
    const fromBackend = this.args.sourceSystems.map((s) =>
      referentialOption(s.code, s.label)
    );
    return [...fromBackend, ...this.addedSourceSystems];
  }

  @cached
  get sourceSystemSelectedItemComponent(): ComponentLike<SelectedItemSignature> {
    return selectedOptionComponent(() => this.sourceSystemOptions);
  }

  setSourceSystem = (option: unknown) => {
    const value = (option as ReferentialOption | null)?.value;
    this.args.changeset.set('sourceSystem', value);
  };

  @action
  toggleAddSourceSystem() {
    this.isAddingSourceSystem = !this.isAddingSourceSystem;
    this.newSourceSystemLabel = '';
  }

  @action
  updateNewSourceSystemLabel(event: Event) {
    this.newSourceSystemLabel = (event.target as HTMLInputElement).value;
  }

  @action
  async addSourceSystem() {
    const label = this.newSourceSystemLabel.trim();
    if (!label || this.sourceSystemSaving) {
      return;
    }
    this.sourceSystemSaving = true;
    try {
      const created = await this.sourceSystem.create(label);
      // Éviter les doublons d'options si le backend a renvoyé un système déjà connu.
      const alreadyKnown = this.sourceSystemOptions.some(
        (o) => o.value === created.code
      );
      if (!alreadyKnown) {
        this.addedSourceSystems = [
          ...this.addedSourceSystems,
          referentialOption(created.code, created.label),
        ];
      }
      this.args.changeset.set('sourceSystem', created.code);
      this.isAddingSourceSystem = false;
      this.newSourceSystemLabel = '';
    } catch {
      this.flashMessages.danger(
        this.intl.t(
          'access-records.forms.accessRecord.messages.sourceSystemError'
        )
      );
    } finally {
      this.sourceSystemSaving = false;
    }
  }

  // dataCategories — multi-select. Stored as a CSV string of codes to match
  // the existing AccessRecordService contract (it splits the CSV into the
  // array the backend expects: dataCategories: array(string()).min(1)).
  //
  // @lat: [[frontend/access-record-options#Bug connu — TpkSelect en mode multiple]]
  // NOTE: @triptyk/ember-input@4.0.0-alpha.1 TpkSelect maps @multiple={{true}}
  // to power-select's @multiple={{undefined}} (its getter is
  // `multiple === true ? undefined : false`), so power-select runs in
  // single-select mode and fires onChange with the single chosen option rather
  // than the full array. We therefore accept BOTH shapes: a real array (future
  // fix) or a single option which we toggle into the existing CSV — giving a
  // working multi-pick experience today.
  setDataCategories = (selection: unknown) => {
    let codes: string[];
    if (Array.isArray(selection)) {
      codes = (selection as ReferentialOption[]).map((o) => o.value);
    } else if (
      selection &&
      typeof selection === 'object' &&
      'value' in selection
    ) {
      const code = String((selection as ReferentialOption).value);
      const current = (this.args.changeset.get('dataCategories') as string)
        ? (this.args.changeset.get('dataCategories') as string)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      codes = current.includes(code)
        ? current.filter((s) => s !== code)
        : [...current, code];
    } else {
      codes = [];
    }
    this.args.changeset.set('dataCategories', codes.join(','));
  };

  <template>
    <h1 class="text-2xl font-semibold mb-4" data-test-access-record-form-title>
      {{t "access-records.pages.create.title"}}
    </h1>
    <TpkForm
      @changeset={{@changeset}}
      @onSubmit={{this.onSubmit}}
      @validationSchema={{@validationSchema}}
      data-test-access-record-form
      as |F|
    >
      <div class="grid grid-cols-12 gap-x-6 gap-y-3 max-w-4xl">
        <F.TpkDatepickerPrefab
          @label={{t "access-records.forms.accessRecord.labels.accessedAt"}}
          @validationField="accessedAt"
          @onChange={{this.setAccessedAt}}
          @dateFormat="yyyy-MM-dd[T]HH:mm:ss[Z]"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkSelectPrefab
          @label={{t "access-records.forms.accessRecord.labels.accessorRef"}}
          @validationField="accessorRef"
          @options={{this.accessorOptions}}
          @placeholder={{t
            "access-records.forms.accessRecord.placeholders.select"
          }}
          class="col-span-12 md:col-span-6"
        />
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.dataSubjectRef"}}
          @validationField="dataSubjectRef"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkSelectPrefab
          @label={{t "access-records.forms.accessRecord.labels.dataCategories"}}
          @validationField="dataCategories"
          @multiple={{true}}
          @options={{this.dataCategoryOptions}}
          @onChange={{this.setDataCategories}}
          @selectedItemComponent={{this.dataCategorySelectedItemComponent}}
          @placeholder={{t
            "access-records.forms.accessRecord.placeholders.select"
          }}
          class="col-span-12 md:col-span-6"
        />
        <F.TpkSelectPrefab
          @label={{t "access-records.forms.accessRecord.labels.accessType"}}
          @validationField="accessType"
          @options={{this.accessTypeOptions}}
          @placeholder={{t
            "access-records.forms.accessRecord.placeholders.select"
          }}
          class="col-span-12 md:col-span-6"
        />
        <F.TpkSelectPrefab
          @label={{t "access-records.forms.accessRecord.labels.purpose"}}
          @validationField="purpose"
          @options={{this.purposeOptions}}
          @onChange={{this.setPurpose}}
          @selectedItemComponent={{this.purposeSelectedItemComponent}}
          @placeholder={{t
            "access-records.forms.accessRecord.placeholders.select"
          }}
          class="col-span-12 md:col-span-6"
        />
        <F.TpkSelectPrefab
          @label={{t "access-records.forms.accessRecord.labels.legalBasis"}}
          @validationField="legalBasis"
          @options={{this.legalBasisOptions}}
          @onChange={{this.setLegalBasis}}
          @selectedItemComponent={{this.legalBasisSelectedItemComponent}}
          @placeholder={{t
            "access-records.forms.accessRecord.placeholders.select"
          }}
          class="col-span-12 md:col-span-6"
        />
        <div class="col-span-12 md:col-span-6">
          <F.TpkSelectPrefab
            @label={{t "access-records.forms.accessRecord.labels.sourceSystem"}}
            @validationField="sourceSystem"
            @options={{this.sourceSystemOptions}}
            @onChange={{this.setSourceSystem}}
            @selectedItemComponent={{this.sourceSystemSelectedItemComponent}}
            @placeholder={{t
              "access-records.forms.accessRecord.placeholders.select"
            }}
          />
          {{#if this.isAddingSourceSystem}}
            <div class="flex items-center gap-2 mt-2">
              <input
                type="text"
                class="input input-bordered input-sm flex-1"
                aria-label={{t
                  "access-records.forms.accessRecord.placeholders.newSourceSystem"
                }}
                placeholder={{t
                  "access-records.forms.accessRecord.placeholders.newSourceSystem"
                }}
                value={{this.newSourceSystemLabel}}
                {{on "input" this.updateNewSourceSystemLabel}}
                data-test-new-source-system-input
              />
              <button
                type="button"
                class="btn btn-sm btn-primary"
                disabled={{this.sourceSystemSaving}}
                {{on "click" this.addSourceSystem}}
                data-test-save-source-system
              >
                {{t
                  "access-records.forms.accessRecord.actions.saveSourceSystem"
                }}
              </button>
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                {{on "click" this.toggleAddSourceSystem}}
              >
                {{t
                  "access-records.forms.accessRecord.actions.cancelSourceSystem"
                }}
              </button>
            </div>
          {{else}}
            <button
              type="button"
              class="btn btn-link btn-sm px-0 mt-1"
              {{on "click" this.toggleAddSourceSystem}}
              data-test-add-source-system
            >
              {{t "access-records.forms.accessRecord.actions.addSourceSystem"}}
            </button>
          {{/if}}
        </div>
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.recipient"}}
          @validationField="recipient"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkCheckboxPrefab
          @label={{t
            "access-records.forms.accessRecord.labels.isSpecialCategory"
          }}
          @validationField="isSpecialCategory"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkTextareaPrefab
          @label={{t "access-records.forms.accessRecord.labels.justification"}}
          @validationField="justification"
          class="col-span-12"
        />
        <div class="col-span-12 flex items-center justify-between gap-2">
          <button type="submit" class="btn btn-primary">
            {{t "access-records.forms.accessRecord.actions.submit"}}
          </button>
          <LinkTo
            @route="dashboard.access-records"
            class="text-sm text-primary underline text-center mt-2 inline-flex items-center gap-1"
          >
            <ArrowLeftIcon class="size-4" />
            {{t "access-records.forms.accessRecord.actions.back"}}
          </LinkTo>
        </div>
      </div>
    </TpkForm>
  </template>
}

export const pageObject = create({
  scope: '[data-test-access-record-form]',
  accessedAt: fillable(
    '[data-test-tpk-prefab-datepicker-container="accessedAt"] input'
  ),
  // accessorRef is now an ember-power-select trigger (users habilités), not a
  // plain input: open it then pick an option via power-select test helpers.
  openAccessor: clickable(
    '[data-test-tpk-prefab-select-container="accessorRef"] .ember-power-select-trigger'
  ),
  dataSubjectRef: fillable(
    '[data-test-tpk-prefab-input-container="dataSubjectRef"] input'
  ),
  // Select fields are ember-power-select triggers (not plain inputs): the
  // page object only exposes a clickable trigger; tests pick options via the
  // power-select test helpers (clickTrigger + selectChoose-style click).
  openAccessType: clickable(
    '[data-test-tpk-prefab-select-container="accessType"] .ember-power-select-trigger'
  ),
  openPurpose: clickable(
    '[data-test-tpk-prefab-select-container="purpose"] .ember-power-select-trigger'
  ),
  openLegalBasis: clickable(
    '[data-test-tpk-prefab-select-container="legalBasis"] .ember-power-select-trigger'
  ),
  openDataCategories: clickable(
    '[data-test-tpk-prefab-select-container="dataCategories"] .ember-power-select-trigger'
  ),
  // sourceSystem is now a referential-backed select (creatable) instead of a
  // plain input: open the trigger, or use the "+ Ajouter" affordance below.
  openSourceSystem: clickable(
    '[data-test-tpk-prefab-select-container="sourceSystem"] .ember-power-select-trigger'
  ),
  clickAddSourceSystem: clickable('[data-test-add-source-system]'),
  fillNewSourceSystem: fillable('[data-test-new-source-system-input]'),
  clickSaveSourceSystem: clickable('[data-test-save-source-system]'),
  justification: fillable(
    '[data-test-tpk-prefab-textarea-container="justification"] textarea'
  ),
  submit: clickable('button[type="submit"]'),
});
