import Component from '@glimmer/component';
import { service } from '@ember/service';
import { LinkTo } from '@ember/routing';
import { t, type IntlService } from 'ember-intl';
import type { AccessRecord } from '#src/schemas/access-records.ts';
import ArrowLeftIcon from '@libs/shared-front/assets/icons/arrow-left';
import SpecialCategoryIcon from '#src/assets/icons/special-category.gts';

interface AccessRecordDetailArgs {
  record: AccessRecord;
}

// Vue détail en LECTURE SEULE d'un access-record. Le registre est append-only
// (aucune édition possible — cf. triggers Postgres) : ce composant ne contient
// donc aucun champ éditable.
export default class AccessRecordDetail extends Component<AccessRecordDetailArgs> {
  @service declare intl: IntlService;

  private formatDate(raw: string | null | undefined): string {
    if (!raw) {
      return '—';
    }
    return new Date(raw).toLocaleString(this.intl.primaryLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  get accessedAt(): string {
    return this.formatDate(this.args.record.accessedAt);
  }

  get encodedAt(): string {
    return this.formatDate(this.args.record.encodedAt);
  }

  get retentionUntil(): string {
    return this.formatDate(this.args.record.retentionUntil);
  }

  get dataCategories(): string {
    const cats = this.args.record.dataCategories as string[] | undefined;
    return cats?.length ? cats.join(', ') : '—';
  }

  get encodedByLabel(): string {
    return this.args.record.encodedByName ?? this.args.record.encodedBy ?? '—';
  }

  <template>
    <div class="max-w-4xl space-y-6" data-test-access-record-detail>
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold">
            {{t "access-records.pages.show.title"}}
          </h1>
          <p class="text-sm text-base-content/70">
            {{@record.dataSubjectRef}}
          </p>
        </div>
        {{#if @record.isSpecialCategory}}
          <span class="badge badge-warning gap-1" data-test-detail-sensitive>
            <SpecialCategoryIcon class="size-4" />
            {{t "access-records.table.headers.isSpecialCategory"}}
          </span>
        {{/if}}
      </header>

      <dl class="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        <div>
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.accessedAt"}}
          </dt>
          <dd>{{this.accessedAt}}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.accessorRef"}}
          </dt>
          <dd>{{@record.accessorRef}}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.dataSubjectRef"}}
          </dt>
          <dd>{{@record.dataSubjectRef}}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.dataCategories"}}
          </dt>
          <dd>{{this.dataCategories}}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.accessType"}}
          </dt>
          <dd>{{@record.accessType}}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.purpose"}}
          </dt>
          <dd>{{@record.purpose}}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.legalBasis"}}
          </dt>
          <dd>{{@record.legalBasis}}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.sourceSystem"}}
          </dt>
          <dd>{{@record.sourceSystem}}</dd>
        </div>
        <div>
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.recipient"}}
          </dt>
          <dd>{{if @record.recipient @record.recipient "—"}}</dd>
        </div>
        <div class="md:col-span-2">
          <dt class="text-sm font-medium text-base-content/60">
            {{t "access-records.forms.accessRecord.labels.justification"}}
          </dt>
          <dd class="whitespace-pre-line">{{@record.justification}}</dd>
        </div>
      </dl>

      <section class="border-t border-base-300 pt-4">
        <h2 class="mb-2 text-sm font-semibold text-base-content/60">
          {{t "access-records.detail.metadata"}}
        </h2>
        <dl class="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
          <div>
            <dt class="text-sm font-medium text-base-content/60">
              {{t "access-records.detail.encodedBy"}}
            </dt>
            <dd>{{this.encodedByLabel}}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-base-content/60">
              {{t "access-records.detail.encodedAt"}}
            </dt>
            <dd>{{this.encodedAt}}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-base-content/60">
              {{t "access-records.detail.retentionUntil"}}
            </dt>
            <dd>{{this.retentionUntil}}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-base-content/60">
              {{t "access-records.detail.seq"}}
            </dt>
            <dd>{{@record.seq}}</dd>
          </div>
        </dl>
      </section>

      <LinkTo
        @route="dashboard.access-records"
        class="inline-flex items-center gap-1 text-sm text-primary underline"
      >
        <ArrowLeftIcon class="size-4" />
        {{t "access-records.forms.accessRecord.actions.back"}}
      </LinkTo>
    </div>
  </template>
}
