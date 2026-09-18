import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { RowInput } from '#src/components/forms/incident-row-fields.gts';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { t } from 'ember-intl';

export interface TimelineEventDraft {
  date: string;
  time: string;
  event: string;
}

interface Args {
  items: TimelineEventDraft[];
  onChange: (items: TimelineEventDraft[]) => void;
}

export default class IncidentTimelineEditor extends Component<Args> {
  @tracked draft: TimelineEventDraft = { date: '', time: '', event: '' };

  @tracked hint = '';

  // `TpkInputInput` renvoie `input.valueAsDate` (un Date, ou null) pour
  // `@type="date"` et non la chaîne saisie : sans normalisation le brouillon
  // stockerait « Thu Aug 20 2026 00:00:00 GMT… », que le backend et le PDF
  // afficheraient tel quel. On reprojette en `yyyy-MM-dd`.
  @action
  updateField(
    field: keyof TimelineEventDraft,
    value: string | number | Date | null
  ) {
    this.hint = '';
    const normalized =
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value ?? '');
    this.draft = {
      ...this.draft,
      [field]: normalized,
    };
  }

  @action
  addItem() {
    if (!this.draft.date || !this.draft.time || !this.draft.event.trim()) {
      this.hint = 'incomplete';
      return;
    }
    this.args.onChange([
      ...(this.args.items ?? []),
      { ...this.draft, event: this.draft.event.trim() },
    ]);
    this.draft = { date: '', time: '', event: '' };
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
      data-test-incident-timeline
    >
      <legend class="fieldset-legend">{{t
          "incidents.form.sections.timeline"
        }}</legend>
      <div class="grid grid-cols-12 gap-2 mb-3">
        <div class="col-span-12 md:col-span-3">
          <RowInput
            @label={{t "incidents.form.rowLabels.timelineDate"}}
            @value={{this.draft.date}}
            @type="date"
            @placeholder={{t "incidents.form.placeholders.timelineDate"}}
            @onChange={{fn this.updateField "date"}}
            data-test-timeline-date
          />
        </div>
        <div class="col-span-12 md:col-span-2">
          <RowInput
            @label={{t "incidents.form.rowLabels.timelineTime"}}
            @value={{this.draft.time}}
            @type="time"
            @placeholder={{t "incidents.form.placeholders.timelineTime"}}
            @onChange={{fn this.updateField "time"}}
            data-test-timeline-time
          />
        </div>
        <div class="col-span-12 md:col-span-5">
          <RowInput
            @label={{t "incidents.form.rowLabels.timelineEvent"}}
            @value={{this.draft.event}}
            @placeholder={{t "incidents.form.placeholders.timelineEvent"}}
            @onChange={{fn this.updateField "event"}}
            data-test-timeline-event
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
            <li
              class="flex items-center justify-between gap-2 bg-base-200 px-2 py-1"
            >
              <span>{{item.date}} {{item.time}} — {{item.event}}</span>
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
