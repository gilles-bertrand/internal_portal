import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { LinkTo } from '@ember/routing';
import TpkButton from '@triptyk/ember-input/components/prefabs/tpk-prefab-button';
import { t, type IntlService } from 'ember-intl';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import ArrowLeftIcon from '@libs/shared-front/assets/icons/arrow-left';
import type { Incident, IncidentSignature } from '#src/schemas/incidents.ts';
import type IncidentExportService from '#src/services/incident-export.ts';
import {
  classificationLabelKey,
  environmentLabelKey,
  optionLabel,
  severityLabelKey,
  statusLabelKey,
} from '#src/utils/incident-options.ts';
import {
  AccessLogList,
  ActionList,
  Chips,
  DescriptionBlocks,
  DetailSection,
  Field,
  Hash,
  LongText,
  PlanList,
  Signer,
  Timeline,
  type AccessLogRow,
  type ActionRow,
  type PlanRow,
  type TimelineRow,
} from '#src/components/incident-detail-parts.gts';

interface IncidentDetailArgs {
  incident: Incident;
}

// Une entrée de plan de communication est un objet libre : ses valeurs peuvent
// être des tableaux ou des objets imbriqués. On les aplatit en texte, sinon le
// template rendrait « [object Object] ».
function planValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => planValue(item)).join(', ');
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => planValue(item))
      .join(' — ');
  }
  return '';
}

// Vue détail en LECTURE SEULE d'un incident. Le registre est versionné et
// append-only : l'édition passe par la route `edit` (qui crée une révision),
// jamais par cette page — d'où l'absence de tout champ éditable ici.
//
// Les regroupements de sections reproduisent les 8 étapes du wizard et les
// sections §1–§10 du rapport PDF, pour qu'une relecture écran et une relecture
// PDF se lisent dans le même ordre.
// @lat: [[frontend/access-record-options#Libellés bilingues résolus côté frontend]]
export default class IncidentDetail extends Component<IncidentDetailArgs> {
  @service declare incidentExport: IncidentExportService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  @tracked exporting = false;

  get emptyLabel(): string {
    return this.intl.t('incidents.detail.empty');
  }

  // Toute date affichée passe par ici : jamais d'ISO brut à l'écran. Une valeur
  // non parsable (donnée héritée, saisie libre) est rendue telle quelle plutôt
  // que « Invalid Date ».
  private display(raw: string | null | undefined, withTime: boolean): string {
    if (!raw) {
      return '';
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }
    return parsed.toLocaleString(
      this.intl.primaryLocale,
      withTime
        ? { dateStyle: 'medium', timeStyle: 'short' }
        : { dateStyle: 'medium' }
    );
  }

  private date(raw: string | null | undefined): string {
    return this.display(raw, true) || this.emptyLabel;
  }

  // Variante sans heure et sans repli : utilisée à l'intérieur des listes JSON,
  // où la mention « non renseigné » par ligne serait du bruit.
  private day(raw: string | null | undefined): string {
    return this.display(raw, false);
  }

  private text(raw: string | null | undefined): string {
    return raw?.trim() ? raw : this.emptyLabel;
  }

  // `0` est une valeur significative (aucune personne impactée) : on ne peut pas
  // se contenter d'un test de véracité.
  private num(raw: number | null | undefined): string {
    return raw === null || raw === undefined ? this.emptyLabel : String(raw);
  }

  private bool(raw: boolean | null | undefined): string {
    if (raw === null || raw === undefined) {
      return this.emptyLabel;
    }
    return this.intl.t(raw ? 'incidents.filters.yes' : 'incidents.filters.no');
  }

  private option(
    raw: string | null | undefined,
    labelKey: (value: string) => string
  ): string {
    return raw ? optionLabel(raw, labelKey, this.intl) : this.emptyLabel;
  }

  // Un seul getter pour tous les champs scalaires : le type est inféré, donc
  // `this.fields.clientCode` reste typé, et chaque valeur est déjà formatée avec
  // son repli — le template n'a plus aucune logique de présentation.
  get fields() {
    const incident = this.args.incident;
    return {
      version: this.text(incident.version),
      classification: this.option(
        incident.classification,
        classificationLabelKey
      ),
      status: this.option(incident.status, statusLabelKey),
      environment: this.option(incident.environment, environmentLabelKey),
      clientCode: this.text(incident.clientCode),
      clientName: this.text(incident.clientName),
      applicationName: this.text(incident.applicationName),
      applicationDetail: this.text(incident.applicationDetail),
      reportedBy: this.text(incident.reportedBy),
      legalContext: this.text(incident.legalContext),
      reportDate: this.date(incident.reportDate),
      recipientName: this.text(incident.recipientName),
      recipientOrg: this.text(incident.recipientOrg),
      serviceName: this.text(incident.serviceName),
      deployedVersion: this.text(incident.deployedVersion),
      technicalLeadId: this.text(incident.technicalLeadId),
      incidentStartAt: this.date(incident.incidentStartAt),
      incidentEndAt: this.date(incident.incidentEndAt),
      detectedAt: this.date(incident.detectedAt),
      resolvedAt: this.date(incident.resolvedAt),
      resolutionDurationMinutes: this.num(incident.resolutionDurationMinutes),
      description: this.text(incident.description),
      personalDataImpacted: this.bool(incident.personalDataImpacted),
      specialCategoryData: this.bool(incident.specialCategoryData),
      apdNotificationRequired: this.bool(incident.apdNotificationRequired),
      impactSummary: this.text(incident.impactSummary),
      severityOperational: this.option(
        incident.severityOperational,
        severityLabelKey
      ),
      severityCompliance: this.option(
        incident.severityCompliance,
        severityLabelKey
      ),
      severityOverall: this.option(incident.severityOverall, severityLabelKey),
      affectedPersonsCount: this.num(incident.affectedPersonsCount),
      affectedPatientsCount: this.num(incident.affectedPatientsCount),
      immediateCause: this.text(incident.immediateCause),
      conclusion: this.text(incident.conclusion),
      encodedBy: this.text(incident.encodedByName ?? incident.encodedBy),
      encodedAt: this.date(incident.encodedAt),
      updatedBy: this.text(incident.updatedBy),
      updatedAt: this.date(incident.updatedAt),
    };
  }

  get isDeleted(): boolean {
    return Boolean(this.args.incident.deletedAt);
  }

  // Une révision > 1 signale que l'incident affiché remplace une version
  // antérieure : l'information est portée par un badge, comme dans le tableau.
  get hasRevisions(): boolean {
    return (this.args.incident.revision ?? 1) > 1;
  }

  // Repli `body ?? detail` pour les enregistrements ÉCRITS AVANT le correctif
  // de `normalizeIncidentPayload` : le formulaire envoyait `detail`, que le
  // `.passthrough()` du backend acceptait, donc leur corps de section est
  // persisté sous ce nom. La table est append-only et protégée par trigger :
  // ces lignes ne peuvent pas être réparées par UPDATE, seule la lecture peut
  // les rattraper. Sans ce repli, leur contenu reste invisible pour toujours.
  get descriptionBlocks() {
    const sections = (this.args.incident.descriptionSections ?? []) as {
      title: string;
      body?: string;
      detail?: string;
      items?: string[];
    }[];
    return sections.map((section) => ({
      ...section,
      body: section.body ?? section.detail,
    }));
  }

  get impactNature(): string[] {
    return this.args.incident.impactDetails?.nature ?? [];
  }

  get impactSeverityIntro(): string {
    return this.args.incident.impactDetails?.severityIntro ?? '';
  }

  get impactSeverityPoints(): string[] {
    return this.args.incident.impactDetails?.severityPoints ?? [];
  }

  get contributingFactors(): string[] {
    return (this.args.incident.contributingFactors as string[] | null) ?? [];
  }

  get preventiveMeasures(): string[] {
    return (this.args.incident.preventiveMeasures as string[] | null) ?? [];
  }

  get timelineEvents(): TimelineRow[] {
    const events =
      (this.args.incident.timelineEvents as
        | { date: string; time: string; event: string }[]
        | null) ?? [];
    return events.map((event) => ({
      when: [this.day(event.date), event.time].filter(Boolean).join(' '),
      event: event.event,
    }));
  }

  // Les actions correctives portent un `order` métier (phases §7 du rapport) :
  // on le respecte plutôt que l'ordre de stockage JSON.
  get correctiveActions(): ActionRow[] {
    const actions =
      (this.args.incident.correctiveActions as
        | {
            phase?: string;
            order: number;
            title: string;
            detail: string;
            completedAt?: string;
          }[]
        | null) ?? [];
    return [...actions]
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .map((action) => ({
        phase: action.phase,
        title: action.title,
        detail: action.detail,
        completedAt: this.day(action.completedAt),
      }));
  }

  get accessLogs(): AccessLogRow[] {
    const logs =
      (this.args.incident.accessLogs as
        | {
            date: string;
            user: string;
            email: string;
            files: string;
            count: number;
          }[]
        | null) ?? [];
    return logs.map((log) => ({
      when: this.day(log.date),
      user: log.user,
      email: log.email,
      files: log.files,
      count: log.count,
    }));
  }

  get communicationPlan(): PlanRow[][] {
    const plan =
      (this.args.incident.communicationPlan as
        | Record<string, unknown>[]
        | null) ?? [];
    return plan.map((entry) =>
      Object.entries(entry).map(([label, value]) => ({
        label,
        value: planValue(value),
      }))
    );
  }

  private signerDetail(signature: IncidentSignature | null): string {
    return [signature?.role, signature?.org].filter(Boolean).join(' — ');
  }

  get issuer() {
    const signature = this.args.incident.issuerSignature;
    return {
      name: this.text(signature?.name),
      detail: this.signerDetail(signature),
      date: this.date(signature?.date),
    };
  }

  get recipient() {
    const signature = this.args.incident.recipientSignature;
    return {
      name: this.text(signature?.name),
      detail: this.signerDetail(signature),
      date: this.date(signature?.date),
    };
  }

  // Le premier maillon de la chaîne d'intégrité a un prevHash à zéro : l'afficher
  // tel quel laisse croire à une empreinte réelle.
  get isGenesis(): boolean {
    return /^0+$/.test(this.args.incident.prevHash ?? '');
  }

  // L'export cible un incident précis : sans `id` (enregistrement pas encore
  // persisté), l'appel produirait une URL `/incidents/undefined/export`.
  exportPdf = async () => {
    const incidentId = this.args.incident.id;
    if (!incidentId || this.exporting) {
      return;
    }
    this.exporting = true;
    try {
      await this.incidentExport.downloadIncidentPdf(incidentId);
      this.flashMessages.success(this.intl.t('incidents.export.success'));
    } catch {
      this.flashMessages.danger(this.intl.t('incidents.export.error'));
    } finally {
      this.exporting = false;
    }
  };

  <template>
    <div class="mx-auto max-w-5xl space-y-5" data-test-incident-detail>
      <LinkTo
        @route="dashboard.incidents"
        class="inline-flex items-center gap-1 text-sm text-base-content/70 transition-colors hover:text-primary"
      >
        <ArrowLeftIcon class="size-4" />
        {{t "incidents.detail.back"}}
      </LinkTo>

      <header
        class="rounded-box border border-base-300 bg-base-200/60 p-5 sm:p-6"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-2xl font-semibold tracking-tight">
              {{t "incidents.pages.show.title"}}
            </h1>
            <p class="mt-1 text-sm text-base-content/70">
              {{t "incidents.detail.subtitle" date=this.fields.reportDate}}
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <span class="badge badge-ghost font-mono">
              {{t "incidents.detail.sequenceBadge" seq=@incident.seq}}
            </span>
            <span class="badge badge-outline badge-sm">
              {{t "incidents.detail.readOnly"}}
            </span>
            {{#if this.hasRevisions}}
              <span class="badge badge-info badge-sm" data-test-detail-revision>
                {{t
                  "incidents.detail.revisionBadge"
                  revision=@incident.revision
                }}
              </span>
            {{/if}}
            {{#if this.isDeleted}}
              <span class="badge badge-error badge-sm" data-test-detail-deleted>
                {{t "incidents.detail.deletedBadge"}}
              </span>
            {{/if}}
            {{#if @incident.specialCategoryData}}
              <span class="badge badge-warning" data-test-detail-sensitive>
                {{t "incidents.table.headers.art9"}}
              </span>
            {{/if}}
            <TpkButton
              @label={{if
                this.exporting
                (t "incidents.export.inProgress")
                (t "incidents.actions.exportReport")
              }}
              @onClick={{this.exportPdf}}
              @disabled={{this.exporting}}
              class="btn-sm btn-primary"
              data-test-export-report-button
            />
          </div>
        </div>

        <div class="mt-5 border-t border-base-300 pt-4">
          <p
            class="text-xs font-medium uppercase tracking-wide text-base-content/50"
          >
            {{t "incidents.table.headers.reference"}}
          </p>
          <p class="mt-1 break-words text-lg font-semibold">
            {{@incident.reference}}
          </p>
          <p class="mt-1 text-sm text-base-content/70">
            {{this.fields.clientName}}
            —
            {{this.fields.applicationName}}
          </p>
        </div>
      </header>

      <div class="grid gap-5 lg:grid-cols-2">
        <DetailSection @title={{t "incidents.detail.sections.identification"}}>
          <Field @label={{t "incidents.form.clientCode"}}>
            {{this.fields.clientCode}}
          </Field>
          <Field @label={{t "incidents.form.clientName"}}>
            {{this.fields.clientName}}
          </Field>
          <Field @label={{t "incidents.form.applicationName"}}>
            {{this.fields.applicationName}}
          </Field>
          <Field @label={{t "incidents.form.applicationDetail"}}>
            {{this.fields.applicationDetail}}
          </Field>
          <Field @label={{t "incidents.form.status"}}>
            <span class="badge badge-neutral badge-sm">
              {{this.fields.status}}
            </span>
          </Field>
          <Field @label={{t "incidents.form.classification"}}>
            <span class="badge badge-neutral badge-sm">
              {{this.fields.classification}}
            </span>
          </Field>
          <Field @label={{t "incidents.form.environment"}}>
            <span class="badge badge-neutral badge-sm">
              {{this.fields.environment}}
            </span>
          </Field>
          <Field @label={{t "incidents.form.version"}}>
            {{this.fields.version}}
          </Field>
          <Field @label={{t "incidents.form.reportedBy"}}>
            {{this.fields.reportedBy}}
          </Field>
          <Field @label={{t "incidents.form.reportDate"}}>
            {{this.fields.reportDate}}
          </Field>
          <Field @label={{t "incidents.form.legalContext"}} @wide={{true}}>
            <LongText @value={{this.fields.legalContext}} />
          </Field>
        </DetailSection>

        <DetailSection @title={{t "incidents.detail.sections.context"}}>
          <Field @label={{t "incidents.form.recipientName"}}>
            {{this.fields.recipientName}}
          </Field>
          <Field @label={{t "incidents.form.recipientOrg"}}>
            {{this.fields.recipientOrg}}
          </Field>
          <Field @label={{t "incidents.form.serviceName"}}>
            {{this.fields.serviceName}}
          </Field>
          <Field @label={{t "incidents.form.deployedVersion"}}>
            {{this.fields.deployedVersion}}
          </Field>
          <Field @label={{t "incidents.form.incidentStartAt"}}>
            {{this.fields.incidentStartAt}}
          </Field>
          <Field @label={{t "incidents.form.incidentEndAt"}}>
            {{this.fields.incidentEndAt}}
          </Field>
          <Field @label={{t "incidents.form.detectedAt"}}>
            {{this.fields.detectedAt}}
          </Field>
          <Field @label={{t "incidents.form.resolvedAt"}}>
            {{this.fields.resolvedAt}}
          </Field>
          <Field @label={{t "incidents.form.resolutionDurationMinutes"}}>
            {{this.fields.resolutionDurationMinutes}}
          </Field>
          <Field @label={{t "incidents.form.technicalLeadId"}}>
            {{this.fields.technicalLeadId}}
          </Field>
        </DetailSection>
      </div>

      <DetailSection @title={{t "incidents.detail.sections.description"}}>
        <Field @label={{t "incidents.form.description"}} @wide={{true}}>
          <LongText @value={{this.fields.description}} />
        </Field>
        <Field
          @label={{t "incidents.form.sections.descriptionBlocks"}}
          @wide={{true}}
        >
          <DescriptionBlocks
            @blocks={{this.descriptionBlocks}}
            @empty={{this.emptyLabel}}
          />
        </Field>
        <Field @label={{t "incidents.form.sections.timeline"}} @wide={{true}}>
          <Timeline
            @events={{this.timelineEvents}}
            @empty={{this.emptyLabel}}
          />
        </Field>
      </DetailSection>

      <div class="grid gap-5 lg:grid-cols-2">
        <DetailSection @title={{t "incidents.detail.sections.qualification"}}>
          <Field @label={{t "incidents.form.personalDataImpacted"}}>
            {{this.fields.personalDataImpacted}}
          </Field>
          <Field @label={{t "incidents.form.specialCategoryData"}}>
            {{this.fields.specialCategoryData}}
          </Field>
          <Field @label={{t "incidents.form.apdNotificationRequired"}}>
            {{this.fields.apdNotificationRequired}}
          </Field>
          <Field @label={{t "incidents.form.affectedPersonsCount"}}>
            {{this.fields.affectedPersonsCount}}
          </Field>
          <Field @label={{t "incidents.form.affectedPatientsCount"}}>
            {{this.fields.affectedPatientsCount}}
          </Field>
        </DetailSection>

        <DetailSection @title={{t "incidents.detail.sections.impact"}}>
          <Field @label={{t "incidents.form.severityOperational"}}>
            <span class="badge badge-neutral badge-sm">
              {{this.fields.severityOperational}}
            </span>
          </Field>
          <Field @label={{t "incidents.form.severityCompliance"}}>
            <span class="badge badge-neutral badge-sm">
              {{this.fields.severityCompliance}}
            </span>
          </Field>
          <Field @label={{t "incidents.form.severityOverall"}}>
            <span class="badge badge-neutral badge-sm">
              {{this.fields.severityOverall}}
            </span>
          </Field>
          {{! `impactDetails` n'a pas de libellé i18n propre : ses sous-champs
              détaillent l'impact et sont donc rendus sous le résumé. }}
          <Field @label={{t "incidents.form.impactSummary"}} @wide={{true}}>
            <LongText @value={{this.fields.impactSummary}} />
            {{#if this.impactNature}}
              <span class="mt-2 flex flex-wrap gap-1.5">
                {{#each this.impactNature key="@index" as |nature|}}
                  <span class="badge badge-outline badge-sm">{{nature}}</span>
                {{/each}}
              </span>
            {{/if}}
            {{#if this.impactSeverityIntro}}
              <span class="mt-2 block font-normal">
                {{this.impactSeverityIntro}}
              </span>
            {{/if}}
            {{#if this.impactSeverityPoints}}
              <ul class="mt-1 list-disc space-y-1 pl-5 font-normal">
                {{#each this.impactSeverityPoints key="@index" as |point|}}
                  <li>{{point}}</li>
                {{/each}}
              </ul>
            {{/if}}
          </Field>
          {{! Les relevés d'accès quantifient l'exposition des données : ils sont
              lus avec l'impact, même si le PDF les place en annexe. }}
          <Field
            @label={{t "incidents.form.sections.accessLogs"}}
            @wide={{true}}
          >
            <AccessLogList
              @logs={{this.accessLogs}}
              @empty={{this.emptyLabel}}
            />
          </Field>
        </DetailSection>
      </div>

      <DetailSection @title={{t "incidents.detail.sections.measures"}}>
        <Field @label={{t "incidents.form.immediateCause"}} @wide={{true}}>
          <LongText @value={{this.fields.immediateCause}} />
        </Field>
        <Field @label={{t "incidents.form.contributingFactors"}}>
          <Chips
            @values={{this.contributingFactors}}
            @empty={{this.emptyLabel}}
          />
        </Field>
        <Field @label={{t "incidents.form.preventiveMeasures"}}>
          <Chips
            @values={{this.preventiveMeasures}}
            @empty={{this.emptyLabel}}
          />
        </Field>
        <Field
          @label={{t "incidents.form.sections.correctiveActions"}}
          @wide={{true}}
        >
          <ActionList
            @actions={{this.correctiveActions}}
            @empty={{this.emptyLabel}}
          />
        </Field>
      </DetailSection>

      <DetailSection @title={{t "incidents.detail.sections.closing"}}>
        <Field @label={{t "incidents.form.conclusion"}} @wide={{true}}>
          <LongText @value={{this.fields.conclusion}} />
        </Field>
        <Field @label={{t "incidents.form.communicationPlan"}} @wide={{true}}>
          <PlanList
            @entries={{this.communicationPlan}}
            @empty={{this.emptyLabel}}
          />
        </Field>
      </DetailSection>

      <DetailSection @title={{t "incidents.detail.sections.signatures"}}>
        <Field @label={{t "incidents.form.issuerSignatureName"}}>
          <Signer @name={{this.issuer.name}} @detail={{this.issuer.detail}} />
        </Field>
        <Field @label={{t "incidents.form.issuerSignatureDate"}}>
          {{this.issuer.date}}
        </Field>
        <Field @label={{t "incidents.form.recipientSignatureName"}}>
          <Signer
            @name={{this.recipient.name}}
            @detail={{this.recipient.detail}}
          />
        </Field>
        <Field @label={{t "incidents.form.recipientSignatureDate"}}>
          {{this.recipient.date}}
        </Field>
      </DetailSection>

      <DetailSection @title={{t "incidents.detail.sections.traceability"}}>
        <Field @label={{t "incidents.detail.seq"}}>
          <span class="font-mono">{{@incident.seq}}</span>
        </Field>
        <Field @label={{t "incidents.detail.encodedBy"}}>
          {{this.fields.encodedBy}}
        </Field>
        <Field @label={{t "incidents.detail.encodedAt"}}>
          {{this.fields.encodedAt}}
        </Field>
        <Field @label={{t "incidents.detail.updatedBy"}}>
          {{this.fields.updatedBy}}
        </Field>
        <Field @label={{t "incidents.detail.updatedAt"}}>
          {{this.fields.updatedAt}}
        </Field>
        <Field @label={{t "incidents.detail.integrity.hash"}} @wide={{true}}>
          <Hash @value={{@incident.hash}} />
        </Field>
        <Field
          @label={{t "incidents.detail.integrity.prevHash"}}
          @wide={{true}}
        >
          {{#if this.isGenesis}}
            <span class="text-base-content/60">
              {{t "incidents.detail.integrity.genesis"}}
            </span>
          {{else}}
            <Hash @value={{@incident.prevHash}} />
          {{/if}}
        </Field>
      </DetailSection>
    </div>
  </template>
}
