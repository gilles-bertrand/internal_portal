import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import {
  RowInput,
  RowTextarea,
} from '#src/components/forms/incident-row-fields.gts';
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

  // Le bouton « Ajouter » refusait silencieusement une ligne incomplète : le
  // seul retour visible était que rien ne se passait. On explique désormais ce
  // qui manque, comme le fait le gate d'étape du wizard.
  @tracked hint = '';

  @action
  updateTitle(value: string | number | Date | null) {
    this.hint = '';
    this.draft = {
      ...this.draft,
      title: String(value ?? ''),
    };
  }

  @action
  updateDetail(value: string) {
    this.hint = '';
    this.draft = {
      ...this.draft,
      detail: value,
    };
  }

  @action
  addItem() {
    if (!this.draft.title.trim() || !this.draft.detail.trim()) {
      this.hint = 'incomplete';
      return;
    }
    this.args.onChange([
      ...(this.args.items ?? []),
      { title: this.draft.title.trim(), detail: this.draft.detail.trim() },
    ]);
    this.draft = { title: '', detail: '' };
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
      data-test-incident-description-sections
    >
      <legend class="fieldset-legend">{{t
          "incidents.form.sections.descriptionBlocks"
        }}</legend>
      <div class="grid grid-cols-12 gap-2 mb-3">
        <div class="col-span-12 md:col-span-4">
          <RowInput
            @label={{t "incidents.form.rowLabels.sectionTitle"}}
            @value={{this.draft.title}}
            @placeholder={{t "incidents.form.placeholders.sectionTitle"}}
            @onChange={{this.updateTitle}}
            data-test-section-title
          />
        </div>
        <div class="col-span-12 md:col-span-6">
          <RowTextarea
            @label={{t "incidents.form.rowLabels.sectionDetail"}}
            @value={{this.draft.detail}}
            @placeholder={{t "incidents.form.placeholders.sectionDetail"}}
            @onChange={{this.updateDetail}}
            data-test-section-detail
          />
        </div>
        <div class="col-span-12 md:col-span-2 flex items-end">
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
