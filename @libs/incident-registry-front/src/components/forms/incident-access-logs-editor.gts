import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { t } from 'ember-intl';

export interface AccessLogDraft {
  date: string;
  user: string;
  email: string;
  files: string;
  count: number;
}

interface Args {
  items: AccessLogDraft[];
  onChange: (items: AccessLogDraft[]) => void;
}

export default class IncidentAccessLogsEditor extends Component<Args> {
  @tracked draft: AccessLogDraft = {
    date: '',
    user: '',
    email: '',
    files: '',
    count: 0,
  };

  @action
  updateField(field: keyof AccessLogDraft, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.draft = {
      ...this.draft,
      [field]: field === 'count' ? Number(value) || 0 : value,
    };
  }

  @action
  addItem() {
    if (!this.draft.date || !this.draft.user || !this.draft.email) return;
    this.args.onChange([...(this.args.items ?? []), { ...this.draft }]);
    this.draft = { date: '', user: '', email: '', files: '', count: 0 };
  }

  @action
  removeItem(index: number) {
    const next = [...(this.args.items ?? [])];
    next.splice(index, 1);
    this.args.onChange(next);
  }

  <template>
    {{! template-lint-disable require-input-label }}
    <fieldset class="fieldset border border-base-300 p-4">
      <legend class="fieldset-legend">{{t
          "incidents.form.sections.accessLogs"
        }}</legend>
      <div class="grid grid-cols-12 gap-2 mb-3">
        <input
          type="text"
          class="input input-bordered rounded-none col-span-12 md:col-span-2"
          placeholder={{t "incidents.form.placeholders.logDate"}}
          value={{this.draft.date}}
          {{on "input" (fn this.updateField "date")}}
        />
        <input
          type="text"
          class="input input-bordered rounded-none col-span-12 md:col-span-2"
          placeholder={{t "incidents.form.placeholders.logUser"}}
          value={{this.draft.user}}
          {{on "input" (fn this.updateField "user")}}
        />
        <input
          type="text"
          class="input input-bordered rounded-none col-span-12 md:col-span-3"
          placeholder={{t "incidents.form.placeholders.logEmail"}}
          value={{this.draft.email}}
          {{on "input" (fn this.updateField "email")}}
        />
        <input
          type="text"
          class="input input-bordered rounded-none col-span-12 md:col-span-3"
          placeholder={{t "incidents.form.placeholders.logFiles"}}
          value={{this.draft.files}}
          {{on "input" (fn this.updateField "files")}}
        />
        <input
          type="number"
          class="input input-bordered rounded-none col-span-12 md:col-span-1"
          placeholder="#"
          value={{this.draft.count}}
          {{on "input" (fn this.updateField "count")}}
        />
        <div class="col-span-12 md:col-span-1 flex items-end">
          <TpkButton
            @label={{t "incidents.form.actions.addLine"}}
            @onClick={{this.addItem}}
          />
        </div>
      </div>
      {{#if @items.length}}
        <ul class="space-y-1 text-sm">
          {{#each @items as |item index|}}
            <li
              class="flex items-center justify-between gap-2 bg-base-200 px-2 py-1"
            >
              <span>{{item.date}}
                —
                {{item.user}}
                ({{item.email}}) —
                {{item.files}}
                ×{{item.count}}</span>
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
