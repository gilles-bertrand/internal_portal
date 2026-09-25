import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { RowInput } from '#src/components/forms/incident-row-fields.gts';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { t } from 'ember-intl';

export interface CorrectiveActionDraft {
  phase?: string;
  order: number;
  title: string;
  detail: string;
  completedAt?: string;
}

interface Args {
  items: CorrectiveActionDraft[];
  onChange: (items: CorrectiveActionDraft[]) => void;
}

export default class IncidentCorrectiveActionsEditor extends Component<Args> {
  @tracked draft: CorrectiveActionDraft = {
    phase: '',
    order: 1,
    title: '',
    detail: '',
    completedAt: '',
  };

  @tracked hint = '';

  // `completedAt` arrive d'un `<input type="date">` (donc un Date via
  // `valueAsDate`) et doit repartir en `yyyy-MM-dd`.
  @action
  updateField(
    field: keyof CorrectiveActionDraft,
    value: string | number | Date | null
  ) {
    this.hint = '';
    const strValue =
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value ?? '');
    this.draft = {
      ...this.draft,
      [field]: field === 'order' ? Number(strValue) || 1 : strValue,
    };
  }

  @action
  addItem() {
    if (!this.draft.title.trim() || !this.draft.detail.trim()) {
      this.hint = 'incomplete';
      return;
    }
    const nextOrder = (this.args.items?.length ?? 0) + 1;
    this.args.onChange([
      ...(this.args.items ?? []),
      {
        phase: this.draft.phase?.trim() || undefined,
        order: this.draft.order || nextOrder,
        title: this.draft.title.trim(),
        detail: this.draft.detail.trim(),
        completedAt: this.draft.completedAt?.trim() || undefined,
      },
    ]);
    this.draft = {
      phase: '',
      order: nextOrder + 1,
      title: '',
      detail: '',
      completedAt: '',
    };
    this.hint = '';
  }

  @action
  removeItem(index: number) {
    const next = [...(this.args.items ?? [])];
    next.splice(index, 1);
    this.args.onChange(next);
  }

  <template>
    <fieldset
      class="fieldset border border-base-300 p-4"
      data-test-incident-corrective-actions
    >
      <legend class="fieldset-legend">{{t
          "incidents.form.sections.correctiveActions"
        }}</legend>
      <div class="grid grid-cols-12 gap-2 mb-3">
        <div class="col-span-12 md:col-span-2">
          <RowInput
            @label={{t "incidents.form.rowLabels.actionPhase"}}
            @value={{this.draft.phase}}
            @placeholder={{t "incidents.form.placeholders.actionPhase"}}
            @onChange={{fn this.updateField "phase"}}
            data-test-action-phase
          />
        </div>
        <div class="col-span-12 md:col-span-1">
          <RowInput
            @label={{t "incidents.form.rowLabels.actionOrder"}}
            @value={{this.draft.order}}
            @type="number"
            @placeholder="#"
            @onChange={{fn this.updateField "order"}}
            data-test-action-order
          />
        </div>
        <div class="col-span-12 md:col-span-3">
          <RowInput
            @label={{t "incidents.form.rowLabels.actionTitle"}}
            @value={{this.draft.title}}
            @placeholder={{t "incidents.form.placeholders.actionTitle"}}
            @onChange={{fn this.updateField "title"}}
            data-test-action-title
          />
        </div>
        <div class="col-span-12 md:col-span-4">
          <RowInput
            @label={{t "incidents.form.rowLabels.actionDetail"}}
            @value={{this.draft.detail}}
            @placeholder={{t "incidents.form.placeholders.actionDetail"}}
            @onChange={{fn this.updateField "detail"}}
            data-test-action-detail
          />
        </div>
        <div class="col-span-12 md:col-span-2">
          {{! §7 du rapport et art. 33(5) RGPD : une mesure correctrice se
          documente avec sa date de réalisation. Le champ existait dans le
          brouillon et dans le modèle backend mais n'avait aucun input. }}
          <RowInput
            @label={{t "incidents.form.rowLabels.actionCompletedAt"}}
            @value={{this.draft.completedAt}}
            @type="date"
            @placeholder={{t "incidents.form.placeholders.actionCompletedAt"}}
            @onChange={{fn this.updateField "completedAt"}}
            data-test-action-completed-at
          />
        </div>
        <div class="col-span-12 flex justify-end">
          <TpkButton
            @label={{t "incidents.form.actions.addLine"}}
            @onClick={{this.addItem}}
          />
        </div>
      </div>
      {{#if this.hint}}
        <p class="mb-2 text-sm text-error" role="alert" data-test-row-hint>
          {{t "incidents.form.errors.incompleteRow"}}
        </p>
      {{/if}}
      {{#if @items.length}}
        <ul class="space-y-2 text-sm">
          {{#each @items as |item index|}}
            <li
              class="flex items-start justify-between gap-2 bg-base-200 px-2 py-1"
            >
              <span>
                {{#if item.phase}}{{item.phase}} — {{/if}}
                #{{item.order}}
                {{item.title}}:
                {{item.detail}}
                {{#if item.completedAt}}({{item.completedAt}}){{/if}}
              </span>
              <button
                type="button"
                class="btn btn-ghost btn-xs shrink-0"
                {{on "click" (fn this.removeItem index)}}
              >
                {{t "incidents.form.actions.remove"}}
              </button>
            </li>
          {{/each}}
        </ul>
      {{/if}}
    </fieldset>
  </template>
}
