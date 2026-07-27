import Component from '@glimmer/component';
import { service } from '@ember/service';
import { LinkTo } from '@ember/routing';
import type { TOC } from '@ember/component/template-only';
import { t, type IntlService } from 'ember-intl';
import type { AccessRecord } from '#src/schemas/access-records.ts';
import type ReferentialsService from '#src/services/referentials.ts';
import { accessTypeLabelKey } from '#src/utils/access-record-options.ts';
import ArrowLeftIcon from '@libs/shared-front/assets/icons/arrow-left';
import SpecialCategoryIcon from '#src/assets/icons/special-category.gts';

interface AccessRecordDetailArgs {
  record: AccessRecord;
}

// Carte thématique regroupant un sous-ensemble de champs. Le regroupement
// (contexte / qualification RGPD / traçabilité) suit la façon dont un DPO relit
// un enregistrement, plutôt que l'ordre des colonnes en base.
const DetailSection: TOC<{
  Args: { title: string };
  Blocks: { default: [] };
}> = <template>
  <section class="card border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body gap-4 p-5">
      <h2
        class="text-xs font-semibold uppercase tracking-wider text-base-content/60"
      >
        {{@title}}
      </h2>
      <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {{yield}}
      </dl>
    </div>
  </section>
</template>;

// Paire libellé/valeur. `wide` occupe toute la largeur pour les champs longs
// (justification, empreintes d'intégrité).
const Field: TOC<{
  Args: { label: string; wide?: boolean };
  Blocks: { default: [] };
}> = <template>
  <div class="{{if @wide 'sm:col-span-2'}} min-w-0">
    <dt
      class="text-xs font-medium uppercase tracking-wide text-base-content/50"
    >
      {{@label}}
    </dt>
    <dd class="mt-1 text-sm font-medium text-base-content">
      {{yield}}
    </dd>
  </div>
</template>;

// Vue détail en LECTURE SEULE d'un access-record. Le registre est append-only
// (aucune édition possible — cf. triggers Postgres) : ce composant ne contient
// donc aucun champ éditable.
//
// Les champs référentiels (purpose, legalBasis, dataCategories, sourceSystem)
// sont persistés sous forme de CODE : ils sont retraduits en libellés via le
// service `referentials`, chargé par la route — sans lui, la page afficherait
// « support » ou « art6.1b ».
// @lat: [[frontend/access-record-options#Libellés bilingues résolus côté frontend]]
export default class AccessRecordDetail extends Component<AccessRecordDetailArgs> {
  @service declare intl: IntlService;
  @service declare referentials: ReferentialsService;

  private formatDate(raw: string | null | undefined): string {
    if (!raw) {
      return this.emptyLabel;
    }
    return new Date(raw).toLocaleString(this.intl.primaryLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  get emptyLabel(): string {
    return this.intl.t('access-records.detail.empty');
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

  // Chaque catégorie est rendue en chip : une énumération séparée par des
  // virgules devenait illisible dès trois catégories.
  get dataCategoryLabels(): string[] {
    const codes = this.args.record.dataCategories as string[] | undefined;
    return (codes ?? []).map((code) =>
      this.referentials.dataCategoryLabel(code)
    );
  }

  get accessTypeLabel(): string {
    const value = this.args.record.accessType;
    if (!value) {
      return this.emptyLabel;
    }
    // Un type d'accès historique absent de l'enum courant doit rester lisible :
    // on affiche sa valeur brute plutôt qu'une clé de traduction manquante.
    const key = accessTypeLabelKey(value);
    return this.intl.exists(key) ? this.intl.t(key) : value;
  }

  get purposeLabel(): string {
    return this.referentials.purposeLabel(this.args.record.purpose);
  }

  get legalBasisLabel(): string {
    return this.referentials.legalBasisLabel(this.args.record.legalBasis);
  }

  get sourceSystemLabel(): string {
    return this.referentials.sourceSystemLabel(this.args.record.sourceSystem);
  }

  get encodedByLabel(): string {
    return (
      this.args.record.encodedByName ??
      this.args.record.encodedBy ??
      this.emptyLabel
    );
  }

  get recipientLabel(): string {
    return this.args.record.recipient || this.emptyLabel;
  }

  // Le premier maillon de la chaîne d'intégrité a un prevHash à zéro : l'afficher
  // tel quel laisse croire à une empreinte réelle.
  get isGenesis(): boolean {
    return /^0+$/.test(this.args.record.prevHash ?? '');
  }

  <template>
    <div class="mx-auto max-w-5xl space-y-5" data-test-access-record-detail>
      <LinkTo
        @route="dashboard.access-records"
        class="inline-flex items-center gap-1 text-sm text-base-content/70 transition-colors hover:text-primary"
      >
        <ArrowLeftIcon class="size-4" />
        {{t "access-records.forms.accessRecord.actions.back"}}
      </LinkTo>

      <header
        class="rounded-box border border-base-300 bg-base-200/60 p-5 sm:p-6"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-2xl font-semibold tracking-tight">
              {{t "access-records.pages.show.title"}}
            </h1>
            <p class="mt-1 text-sm text-base-content/70">
              {{t "access-records.detail.subtitle" date=this.accessedAt}}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="badge badge-ghost font-mono">
              {{t "access-records.detail.sequenceBadge" seq=@record.seq}}
            </span>
            <span class="badge badge-outline badge-sm">
              {{t "access-records.detail.readOnly"}}
            </span>
            {{#if @record.isSpecialCategory}}
              <span
                class="badge badge-warning gap-1"
                data-test-detail-sensitive
              >
                <SpecialCategoryIcon class="size-4" />
                {{t "access-records.table.headers.isSpecialCategory"}}
              </span>
            {{/if}}
          </div>
        </div>

        <div class="mt-5 border-t border-base-300 pt-4">
          <p
            class="text-xs font-medium uppercase tracking-wide text-base-content/50"
          >
            {{t "access-records.forms.accessRecord.labels.dataSubjectRef"}}
          </p>
          <p class="mt-1 break-words text-lg font-semibold">
            {{@record.dataSubjectRef}}
          </p>
        </div>
      </header>

      <div class="grid gap-5 lg:grid-cols-2">
        <DetailSection @title={{t "access-records.detail.sections.access"}}>
          <Field
            @label={{t "access-records.forms.accessRecord.labels.accessedAt"}}
          >
            {{this.accessedAt}}
          </Field>
          <Field
            @label={{t "access-records.forms.accessRecord.labels.accessType"}}
          >
            <span class="badge badge-neutral badge-sm">
              {{this.accessTypeLabel}}
            </span>
          </Field>
          <Field
            @label={{t "access-records.forms.accessRecord.labels.accessorRef"}}
          >
            {{@record.accessorRef}}
          </Field>
          <Field
            @label={{t "access-records.forms.accessRecord.labels.sourceSystem"}}
          >
            {{this.sourceSystemLabel}}
          </Field>
          <Field
            @label={{t "access-records.forms.accessRecord.labels.recipient"}}
            @wide={{true}}
          >
            {{this.recipientLabel}}
          </Field>
        </DetailSection>

        <DetailSection
          @title={{t "access-records.detail.sections.qualification"}}
        >
          <Field
            @label={{t "access-records.forms.accessRecord.labels.purpose"}}
          >
            {{this.purposeLabel}}
          </Field>
          <Field
            @label={{t "access-records.forms.accessRecord.labels.legalBasis"}}
          >
            {{this.legalBasisLabel}}
          </Field>
          <Field
            @label={{t
              "access-records.forms.accessRecord.labels.dataCategories"
            }}
            @wide={{true}}
          >
            {{#if this.dataCategoryLabels}}
              <span class="flex flex-wrap gap-1.5">
                {{#each this.dataCategoryLabels key="@index" as |label|}}
                  <span class="badge badge-outline badge-sm">{{label}}</span>
                {{/each}}
              </span>
            {{else}}
              {{this.emptyLabel}}
            {{/if}}
          </Field>
        </DetailSection>
      </div>

      <DetailSection
        @title={{t "access-records.detail.sections.justification"}}
      >
        <Field
          @label={{t "access-records.forms.accessRecord.labels.justification"}}
          @wide={{true}}
        >
          <span class="block whitespace-pre-line font-normal leading-relaxed">
            {{@record.justification}}
          </span>
        </Field>
      </DetailSection>

      <DetailSection @title={{t "access-records.detail.sections.traceability"}}>
        <Field @label={{t "access-records.detail.encodedBy"}}>
          {{this.encodedByLabel}}
        </Field>
        <Field @label={{t "access-records.detail.encodedAt"}}>
          {{this.encodedAt}}
        </Field>
        <Field @label={{t "access-records.detail.retentionUntil"}}>
          {{this.retentionUntil}}
        </Field>
        <Field @label={{t "access-records.detail.seq"}}>
          <span class="font-mono">{{@record.seq}}</span>
        </Field>
        <Field
          @label={{t "access-records.detail.integrity.hash"}}
          @wide={{true}}
        >
          <code
            class="block break-all rounded bg-base-200 px-2 py-1 text-xs font-normal"
          >{{@record.hash}}</code>
        </Field>
        <Field
          @label={{t "access-records.detail.integrity.prevHash"}}
          @wide={{true}}
        >
          {{#if this.isGenesis}}
            <span class="text-base-content/60">
              {{t "access-records.detail.integrity.genesis"}}
            </span>
          {{else}}
            <code
              class="block break-all rounded bg-base-200 px-2 py-1 text-xs font-normal"
            >{{@record.prevHash}}</code>
          {{/if}}
        </Field>
      </DetailSection>
    </div>
  </template>
}
