import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { RowInput } from '#src/components/forms/incident-row-fields.gts';
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

  @tracked hint = '';

  @action
  updateField(
    field: keyof AccessLogDraft,
    value: string | number | Date | null
  ) {
    this.hint = '';
    const strValue =
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value ?? '');
    this.draft = {
      ...this.draft,
      [field]: field === 'count' ? Number(strValue) || 0 : strValue,
    };
  }

  @action
  addItem() {
    if (!this.draft.date || !this.draft.user || !this.draft.email) {
      this.hint = 'incomplete';
      return;
    }
    this.args.onChange([...(this.args.items ?? []), { ...this.draft }]);
    this.draft = { date: '', user: '', email: '', files: '', count: 0 };
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
      data-test-incident-access-logs
    >
      <legend class="fieldset-legend">{{t
          "incidents.form.sections.accessLogs"
        }}</legend>
      <div class="grid grid-cols-12 gap-2 mb-3">
        <div class="col-span-12 md:col-span-2">
          <RowInput
            @label={{t "incidents.form.rowLabels.logDate"}}
            @value={{this.draft.date}}
            @type="date"
            @placeholder={{t "incidents.form.placeholders.logDate"}}
            @onChange={{fn this.updateField "date"}}
            data-test-log-date
          />
        </div>
        <div class="col-span-12 md:col-span-2">
          <RowInput
            @label={{t "incidents.form.rowLabels.logUser"}}
            @value={{this.draft.user}}
            @placeholder={{t "incidents.form.placeholders.logUser"}}
            @onChange={{fn this.updateField "user"}}
            data-test-log-user
          />
        </div>
        <div class="col-span-12 md:col-span-3">
          <RowInput
            @label={{t "incidents.form.rowLabels.logEmail"}}
            @value={{this.draft.email}}
            @type="email"
            @placeholder={{t "incidents.form.placeholders.logEmail"}}
            @onChange={{fn this.updateField "email"}}
            data-test-log-email
          />
        </div>
        <div class="col-span-12 md:col-span-3">
          <RowInput
            @label={{t "incidents.form.rowLabels.logFiles"}}
            @value={{this.draft.files}}
            @placeholder={{t "incidents.form.placeholders.logFiles"}}
            @onChange={{fn this.updateField "files"}}
            data-test-log-files
          />
        </div>
        <div class="col-span-12 md:col-span-2">
          <RowInput
            @label={{t "incidents.form.rowLabels.logCount"}}
            @value={{this.draft.count}}
            @type="number"
            @placeholder={{t "incidents.form.placeholders.logCount"}}
            @onChange={{fn this.updateField "count"}}
            data-test-log-count
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
