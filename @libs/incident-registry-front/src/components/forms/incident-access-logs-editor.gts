import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import TpkInput from '@triptyk/ember-input/components/tpk-input';
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
  updateField(field: keyof AccessLogDraft, value: string | number | Date | null) {
    const strValue = String(value ?? '');
    this.draft = {
      ...this.draft,
      [field]: field === 'count' ? Number(strValue) || 0 : strValue,
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
    <fieldset class="fieldset border border-base-300 p-4">
      <legend class="fieldset-legend">{{t
          "incidents.form.sections.accessLogs"
        }}</legend>
      <div class="grid grid-cols-12 gap-2 mb-3">
        <div class="col-span-12 md:col-span-2">
          <TpkInput
            @label=""
            @value={{this.draft.date}}
            @placeholder={{t "incidents.form.placeholders.logDate"}}
            @onChange={{fn this.updateField "date"}}
          />
        </div>
        <div class="col-span-12 md:col-span-2">
          <TpkInput
            @label=""
            @value={{this.draft.user}}
            @placeholder={{t "incidents.form.placeholders.logUser"}}
            @onChange={{fn this.updateField "user"}}
          />
        </div>
        <div class="col-span-12 md:col-span-3">
          <TpkInput
            @label=""
            @value={{this.draft.email}}
            @placeholder={{t "incidents.form.placeholders.logEmail"}}
            @onChange={{fn this.updateField "email"}}
          />
        </div>
        <div class="col-span-12 md:col-span-3">
          <TpkInput
            @label=""
            @value={{this.draft.files}}
            @placeholder={{t "incidents.form.placeholders.logFiles"}}
            @onChange={{fn this.updateField "files"}}
          />
        </div>
        <div class="col-span-12 md:col-span-1">
          <TpkInput
            @label=""
            @value={{this.draft.count}}
            @type="number"
            @placeholder="#"
            @onChange={{fn this.updateField "count"}}
          />
        </div>
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
