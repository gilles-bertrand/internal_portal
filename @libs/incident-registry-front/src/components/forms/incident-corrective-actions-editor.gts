import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import TpkInput from '@triptyk/ember-input/components/tpk-input';
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

  @action
  updateField(
    field: keyof CorrectiveActionDraft,
    value: string | number | Date | null
  ) {
    const strValue = String(value ?? '');
    this.draft = {
      ...this.draft,
      [field]: field === 'order' ? Number(strValue) || 1 : strValue,
    };
  }

  @action
  addItem() {
    if (!this.draft.title.trim() || !this.draft.detail.trim()) return;
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
  }

  @action
  removeItem(index: number) {
    const next = [...(this.args.items ?? [])];
    next.splice(index, 1);
    this.args.onChange(next);
  }

  <template>
    <fieldset class="fieldset border border-base-300 p-4">
      <legend class="fieldset-legend">{{t
          "incidents.form.sections.correctiveActions"
        }}</legend>
      <div class="grid grid-cols-12 gap-2 mb-3">
        <div class="col-span-12 md:col-span-2">
          <TpkInput
            @label=""
            @value={{this.draft.phase}}
            @placeholder={{t "incidents.form.placeholders.actionPhase"}}
            @onChange={{fn this.updateField "phase"}}
          />
        </div>
        <div class="col-span-12 md:col-span-1">
          <TpkInput
            @label=""
            @value={{this.draft.order}}
            @type="number"
            @placeholder="#"
            @onChange={{fn this.updateField "order"}}
          />
        </div>
        <div class="col-span-12 md:col-span-3">
          <TpkInput
            @label=""
            @value={{this.draft.title}}
            @placeholder={{t "incidents.form.placeholders.actionTitle"}}
            @onChange={{fn this.updateField "title"}}
          />
        </div>
        <div class="col-span-12 md:col-span-4">
          <TpkInput
            @label=""
            @value={{this.draft.detail}}
            @placeholder={{t "incidents.form.placeholders.actionDetail"}}
            @onChange={{fn this.updateField "detail"}}
          />
        </div>
        <div class="col-span-12 md:col-span-2 flex items-end">
          <TpkButton
            @label={{t "incidents.form.actions.addLine"}}
            @onClick={{this.addItem}}
          />
        </div>
      </div>
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
