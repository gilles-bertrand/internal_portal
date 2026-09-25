import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { RowInput } from '#src/components/forms/incident-row-fields.gts';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { t } from 'ember-intl';

interface Args {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  // Libellé de la cellule. À défaut, le placeholder sert de libellé : pour ces
  // listes à une colonne il est déjà rédigé comme tel (« Facteur contributif »),
  // et un `<label>` vide est pire que pas de label pour un lecteur d'écran.
  itemLabel?: string;
}

export default class IncidentStringListEditor extends Component<Args> {
  @tracked draft = '';

  @tracked hint = '';

  get itemLabel(): string {
    return this.args.itemLabel ?? this.args.placeholder ?? this.args.label;
  }

  @action
  addItem() {
    const value = this.draft.trim();
    if (!value) {
      this.hint = 'incomplete';
      return;
    }
    this.args.onChange([...(this.args.items ?? []), value]);
    this.draft = '';
    this.hint = '';
  }

  @action
  removeItem(index: number) {
    const next = [...(this.args.items ?? [])];
    next.splice(index, 1);
    this.args.onChange(next);
  }

  @action
  updateDraft(value: string | number | Date | null) {
    this.hint = '';
    this.draft = String(value ?? '');
  }

  <template>
    <fieldset
      class="fieldset border border-base-300 p-4"
      data-test-incident-string-list
    >
      <legend class="fieldset-legend">{{@label}}</legend>
      <div class="flex gap-2 mb-3">
        <div class="w-full">
          <RowInput
            @label={{this.itemLabel}}
            @value={{this.draft}}
            @placeholder={{@placeholder}}
            @onChange={{this.updateDraft}}
            data-test-string-list-input
          />
        </div>
        <div class="flex items-end">
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
