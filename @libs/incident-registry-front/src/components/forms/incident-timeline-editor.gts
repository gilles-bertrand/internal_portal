import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import TpkInput from '@triptyk/ember-input/components/tpk-input';
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

  @action
  updateField(
    field: keyof TimelineEventDraft,
    value: string | number | Date | null
  ) {
    this.draft = {
      ...this.draft,
      [field]: String(value ?? ''),
    };
  }

  @action
  addItem() {
    if (!this.draft.date || !this.draft.time || !this.draft.event.trim())
      return;
    this.args.onChange([
      ...(this.args.items ?? []),
      { ...this.draft, event: this.draft.event.trim() },
    ]);
    this.draft = { date: '', time: '', event: '' };
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
          "incidents.form.sections.timeline"
        }}</legend>
      <div class="grid grid-cols-12 gap-2 mb-3">
        <div class="col-span-12 md:col-span-3">
          <TpkInput
            @label=""
            @value={{this.draft.date}}
            @placeholder={{t "incidents.form.placeholders.timelineDate"}}
            @onChange={{fn this.updateField "date"}}
          />
        </div>
        <div class="col-span-12 md:col-span-2">
          <TpkInput
            @label=""
            @value={{this.draft.time}}
            @placeholder={{t "incidents.form.placeholders.timelineTime"}}
            @onChange={{fn this.updateField "time"}}
          />
        </div>
        <div class="col-span-12 md:col-span-5">
          <TpkInput
            @label=""
            @value={{this.draft.event}}
            @placeholder={{t "incidents.form.placeholders.timelineEvent"}}
            @onChange={{fn this.updateField "event"}}
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
