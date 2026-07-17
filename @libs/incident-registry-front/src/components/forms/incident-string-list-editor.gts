import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import TpkInput from '@triptyk/ember-input/components/tpk-input';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { t } from 'ember-intl';

interface Args {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

export default class IncidentStringListEditor extends Component<Args> {
  @tracked draft = '';

  @action
  addItem() {
    const value = this.draft.trim();
    if (!value) return;
    this.args.onChange([...(this.args.items ?? []), value]);
    this.draft = '';
  }

  @action
  removeItem(index: number) {
    const next = [...(this.args.items ?? [])];
    next.splice(index, 1);
    this.args.onChange(next);
  }

  @action
  updateDraft(value: string | number | Date | null) {
    this.draft = String(value ?? '');
  }

  <template>
    <fieldset class="fieldset border border-base-300 p-4">
      <legend class="fieldset-legend">{{@label}}</legend>
      <div class="flex gap-2 mb-3">
        <div class="w-full">
          <TpkInput
            @label=""
            @value={{this.draft}}
            @placeholder={{@placeholder}}
            @onChange={{this.updateDraft}}
          />
        </div>
        <TpkButton
          @label={{t "incidents.form.actions.addLine"}}
          @onClick={{this.addItem}}
        />
      </div>
      {{#if @items.length}}
        <ul class="space-y-1 text-sm">
          {{#each @items as |item index|}}
            <li
              class="flex items-center justify-between gap-2 bg-base-200 px-2 py-1"
            >
              <span>{{item}}</span>
              <button
                type="button"
                class="btn btn-ghost btn-xs"
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
