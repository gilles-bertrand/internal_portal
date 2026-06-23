import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import TpkInput from '@triptyk/ember-input/components/tpk-input';
import TpkTextarea from '@triptyk/ember-input/components/tpk-textarea';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { t } from 'ember-intl';

export interface DescriptionSectionDraft {
  title: string;
  detail: string;
}

interface Args {
  items: DescriptionSectionDraft[];
  onChange: (items: DescriptionSectionDraft[]) => void;
}

export default class IncidentDescriptionSectionsEditor extends Component<Args> {
  @tracked draft: DescriptionSectionDraft = { title: '', detail: '' };

  @action
  updateTitle(value: string | number | Date | null) {
    this.draft = {
      ...this.draft,
      title: String(value ?? ''),
    };
  }

  @action
  updateDetail(value: string) {
    this.draft = {
      ...this.draft,
      detail: value,
    };
  }

  @action
  addItem() {
    if (!this.draft.title.trim() || !this.draft.detail.trim()) return;
    this.args.onChange([
      ...(this.args.items ?? []),
      { title: this.draft.title.trim(), detail: this.draft.detail.trim() },
    ]);
    this.draft = { title: '', detail: '' };
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
          "incidents.form.sections.descriptionBlocks"
        }}</legend>
      <div class="grid grid-cols-12 gap-2 mb-3">
        <div class="col-span-12 md:col-span-4">
          <TpkInput
            @label=""
            @value={{this.draft.title}}
            @placeholder={{t "incidents.form.placeholders.sectionTitle"}}
            @onChange={{this.updateTitle}}
          />
        </div>
        <div class="col-span-12 md:col-span-6">
          <TpkTextarea
            @label=""
            @value={{this.draft.detail}}
            @placeholder={{t "incidents.form.placeholders.sectionDetail"}}
            @onChange={{this.updateDetail}}
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
            <li class="bg-base-200 px-2 py-2">
              <div class="flex justify-between gap-2">
                <strong>{{item.title}}</strong>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  {{on "click" (fn this.removeItem index)}}
                >
                  {{t "incidents.form.actions.remove"}}
                </button>
              </div>
              <p class="mt-1 whitespace-pre-wrap">{{item.detail}}</p>
            </li>
          {{/each}}
        </ul>
      {{/if}}
    </fieldset>
  </template>
}
