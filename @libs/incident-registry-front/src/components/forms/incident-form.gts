import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import TpkForm from '@triptyk/ember-input-validation/components/tpk-form';
import { service } from '@ember/service';
import type IncidentService from '#src/services/incident.ts';
import type { IncidentChangeset } from '#src/changesets/incident.ts';
import {
  createIncidentValidationSchema,
  INCIDENT_FORM_STEPS,
  type IncidentFormStep,
  validateIncidentStep,
  type ValidatedIncident,
} from '#src/components/forms/incident-validation.ts';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import { t, type IntlService } from 'ember-intl';
import { LinkTo } from '@ember/routing';
import type HandleSaveService from '@libs/shared-front/services/handle-save';
import type ImmerChangeset from 'ember-immer-changeset';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import IncidentStringListEditor from '#src/components/forms/incident-string-list-editor.gts';
import IncidentTimelineEditor from '#src/components/forms/incident-timeline-editor.gts';
import IncidentDescriptionSectionsEditor from '#src/components/forms/incident-description-sections-editor.gts';
import IncidentCorrectiveActionsEditor from '#src/components/forms/incident-corrective-actions-editor.gts';
import IncidentAccessLogsEditor from '#src/components/forms/incident-access-logs-editor.gts';

interface IncidentFormArgs {
  changeset: IncidentChangeset;
  validationSchema: ReturnType<typeof createIncidentValidationSchema>;
}

const CLASSIFICATIONS = ['CONFIDENTIEL', 'INTERNE', 'PUBLIC'] as const;
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const ENVIRONMENTS = ['production', 'staging', 'development'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export default class IncidentForm extends Component<IncidentFormArgs> {
  @service declare incident: IncidentService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;
  @service declare handleSave: HandleSaveService;

  @tracked currentStepIndex = 0;
  @tracked stepErrorMessage = '';

  get classificationOptions(): string[] {
    return [...CLASSIFICATIONS];
  }

  get statusOptions(): string[] {
    return [...STATUSES];
  }

  get environmentOptions(): string[] {
    return [...ENVIRONMENTS];
  }

  get severityOptions(): string[] {
    return [...SEVERITIES];
  }

  get currentStep(): IncidentFormStep {
    return INCIDENT_FORM_STEPS[this.currentStepIndex] ?? 'header';
  }

  get isFirstStep(): boolean {
    return this.currentStepIndex === 0;
  }

  get isLastStep(): boolean {
    return this.currentStepIndex === INCIDENT_FORM_STEPS.length - 1;
  }

  get stepLabels(): string[] {
    return INCIDENT_FORM_STEPS.map((step) =>
      this.intl.t(`incidents.form.steps.${step}`)
    );
  }

  private snapshotChangeset(): Record<string, unknown> {
    const cs = this.args.changeset;
    const keys = [
      'reportDate',
      'version',
      'classification',
      'status',
      'applicationName',
      'applicationDetail',
      'environment',
      'clientCode',
      'clientName',
      'reportedBy',
      'recipientName',
      'recipientOrg',
      'legalContext',
      'serviceName',
      'deployedVersion',
      'incidentStartAt',
      'incidentEndAt',
      'detectedAt',
      'resolvedAt',
      'resolutionDurationMinutes',
      'technicalLeadId',
      'description',
      'descriptionSections',
      'personalDataImpacted',
      'specialCategoryData',
      'apdNotificationRequired',
      'impactSummary',
      'severityOperational',
      'severityCompliance',
      'severityOverall',
      'affectedPersonsCount',
      'affectedPatientsCount',
      'immediateCause',
      'contributingFactors',
      'correctiveActions',
      'preventiveMeasures',
      'communicationPlan',
      'conclusion',
      'timelineEvents',
      'accessLogs',
      'issuerSignature',
      'recipientSignature',
    ] as const;
    return Object.fromEntries(keys.map((key) => [key, cs.get(key)]));
  }

  private normalizePayload(data: ValidatedIncident): ValidatedIncident {
    return {
      ...data,
      incidentEndAt: data.incidentEndAt || null,
      resolvedAt: data.resolvedAt || null,
      resolutionDurationMinutes: data.resolutionDurationMinutes ?? null,
      technicalLeadId: data.technicalLeadId || null,
      apdNotificationRequired: data.apdNotificationRequired ?? null,
      severityOperational: data.severityOperational || null,
      severityCompliance: data.severityCompliance || null,
      severityOverall: data.severityOverall || null,
      affectedPersonsCount: data.affectedPersonsCount ?? null,
      affectedPatientsCount: data.affectedPatientsCount ?? null,
      descriptionSections: data.descriptionSections?.length
        ? data.descriptionSections
        : undefined,
      communicationPlan: data.communicationPlan?.length
        ? data.communicationPlan
        : undefined,
      accessLogs: data.accessLogs?.length ? data.accessLogs : null,
      contributingFactors: data.contributingFactors ?? [],
      correctiveActions: data.correctiveActions ?? [],
      preventiveMeasures: data.preventiveMeasures ?? [],
      timelineEvents: data.timelineEvents ?? [],
    };
  }

  get timelineEvents() {
    return (
      (this.args.changeset.get(
        'timelineEvents'
      ) as ValidatedIncident['timelineEvents']) ?? []
    );
  }

  get descriptionSections() {
    return this.args.changeset.get('descriptionSections') ?? [];
  }

  get contributingFactors() {
    return (
      (this.args.changeset.get(
        'contributingFactors'
      ) as ValidatedIncident['contributingFactors']) ?? []
    );
  }

  get correctiveActions() {
    return (
      (this.args.changeset.get(
        'correctiveActions'
      ) as ValidatedIncident['correctiveActions']) ?? []
    );
  }

  get preventiveMeasures() {
    return (
      (this.args.changeset.get(
        'preventiveMeasures'
      ) as ValidatedIncident['preventiveMeasures']) ?? []
    );
  }

  get accessLogs() {
    return (
      (this.args.changeset.get('accessLogs') as NonNullable<
        ValidatedIncident['accessLogs']
      >) ?? []
    );
  }

  get issuerSignature() {
    return (
      this.args.changeset.get('issuerSignature') ?? {
        name: '',
        date: '',
      }
    );
  }

  get recipientSignature() {
    return (
      this.args.changeset.get('recipientSignature') ?? {
        name: '',
        date: '',
      }
    );
  }

  get stepItems(): { label: string; complete: boolean }[] {
    return this.stepLabels.map((label, index) => ({
      label,
      complete: index <= this.currentStepIndex,
    }));
  }

  get showStepHeader(): boolean {
    return this.currentStep === 'header';
  }

  get showStepContext(): boolean {
    return this.currentStep === 'context';
  }

  get showStepDescription(): boolean {
    return this.currentStep === 'description';
  }

  get showStepImpact(): boolean {
    return this.currentStep === 'impact';
  }

  get showStepTimeline(): boolean {
    return this.currentStep === 'timeline';
  }

  get showStepMeasures(): boolean {
    return this.currentStep === 'measures';
  }

  get showStepClosing(): boolean {
    return this.currentStep === 'closing';
  }

  get showStepSignatures(): boolean {
    return this.currentStep === 'signatures';
  }

  @action
  setArrayField(field: string, value: unknown) {
    this.args.changeset.set(field, value);
  }

  @action
  updateSignature(
    which: 'issuerSignature' | 'recipientSignature',
    field: 'name' | 'date',
    event: Event
  ) {
    const value = (event.target as HTMLInputElement).value;
    const current = this.args.changeset.get(which) ?? {
      name: '',
      date: '',
    };
    this.args.changeset.set(which, { ...current, [field]: value });
  }

  @action
  previousStep() {
    this.stepErrorMessage = '';
    if (this.currentStepIndex > 0) {
      this.currentStepIndex -= 1;
    }
  }

  @action
  nextStep() {
    this.stepErrorMessage = '';
    try {
      const result = validateIncidentStep(
        this.currentStep,
        this.snapshotChangeset(),
        this.intl
      );
      if (!result.ok) {
        this.stepErrorMessage = result.issues.map((i) => i.message).join(' · ');
        return;
      }
      if (this.currentStepIndex < INCIDENT_FORM_STEPS.length - 1) {
        this.currentStepIndex += 1;
      }
    } catch (error) {
      console.error('validateIncidentStep failed', error);
      this.stepErrorMessage = this.intl.t(
        'incidents.form.errors.stepValidation'
      );
    }
  }

  onSubmit = async (
    data: ValidatedIncident,
    c: ImmerChangeset<ValidatedIncident>
  ) => {
    const normalized = this.normalizePayload(data);
    await this.handleSave.handleSave({
      saveAction: () => this.incident.create(normalized),
      changeset: c,
      successMessage: 'incidents.form.success',
      transitionOnSuccess: 'dashboard.incidents',
    });
  };

  <template>
    <TpkForm
      @changeset={{@changeset}}
      @onSubmit={{this.onSubmit}}
      @validationSchema={{@validationSchema}}
      data-test-incident-form
      as |F|
    >
      <ul class="steps steps-horizontal w-full mb-6 overflow-x-auto">
        {{#each this.stepItems as |step index|}}
          <li
            class="step {{if step.complete 'step-primary'}}"
            data-test-incident-step={{index}}
          >
            {{step.label}}
          </li>
        {{/each}}
      </ul>

      {{#if this.stepErrorMessage}}
        <div
          class="alert alert-error mb-4 text-sm"
          data-test-incident-step-error
        >
          {{this.stepErrorMessage}}
        </div>
      {{/if}}

      <div class="grid grid-cols-12 gap-x-6 gap-y-3 max-w-4xl">
        {{#if this.showStepHeader}}
          <h2 class="col-span-12 text-lg font-semibold">{{t
              "incidents.form.steps.header"
            }}</h2>
          <F.TpkInputPrefab
            @label={{t "incidents.form.clientCode"}}
            @validationField="clientCode"
            @placeholder={{t "incidents.form.placeholders.clientCode"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.clientName"}}
            @validationField="clientName"
            @placeholder={{t "incidents.form.placeholders.clientName"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.applicationName"}}
            @validationField="applicationName"
            @placeholder={{t "incidents.form.placeholders.applicationName"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.applicationDetail"}}
            @validationField="applicationDetail"
            @placeholder={{t "incidents.form.placeholders.applicationDetail"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.reportedBy"}}
            @validationField="reportedBy"
            @placeholder={{t "incidents.form.placeholders.reportedBy"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.reportDate"}}
            @validationField="reportDate"
            @placeholder={{t "incidents.form.placeholders.reportDate"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.version"}}
            @validationField="version"
            class="col-span-12 md:col-span-4"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.classification"}}
            @validationField="classification"
            @options={{this.classificationOptions}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-4"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.status"}}
            @validationField="status"
            @options={{this.statusOptions}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-4"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.environment"}}
            @validationField="environment"
            @options={{this.environmentOptions}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.recipientName"}}
            @validationField="recipientName"
            @placeholder={{t "incidents.form.placeholders.recipientName"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.recipientOrg"}}
            @validationField="recipientOrg"
            @placeholder={{t "incidents.form.placeholders.recipientOrg"}}
            class="col-span-12 md:col-span-6"
          />
        {{/if}}

        {{#if this.showStepContext}}
          <h2 class="col-span-12 text-lg font-semibold">{{t
              "incidents.form.steps.context"
            }}</h2>
          <F.TpkTextareaPrefab
            @label={{t "incidents.form.legalContext"}}
            @validationField="legalContext"
            @placeholder={{t "incidents.form.placeholders.legalContext"}}
            class="col-span-12"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.serviceName"}}
            @validationField="serviceName"
            @placeholder={{t "incidents.form.placeholders.serviceName"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.deployedVersion"}}
            @validationField="deployedVersion"
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.incidentStartAt"}}
            @validationField="incidentStartAt"
            @placeholder={{t "incidents.form.placeholders.incidentStartAt"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.incidentEndAt"}}
            @validationField="incidentEndAt"
            @placeholder={{t "incidents.form.placeholders.incidentEndAt"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.detectedAt"}}
            @validationField="detectedAt"
            @placeholder={{t "incidents.form.placeholders.detectedAt"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.resolvedAt"}}
            @validationField="resolvedAt"
            @placeholder={{t "incidents.form.placeholders.resolvedAt"}}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.resolutionDurationMinutes"}}
            @validationField="resolutionDurationMinutes"
            @placeholder={{t
              "incidents.form.placeholders.resolutionDurationMinutes"
            }}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.technicalLeadId"}}
            @validationField="technicalLeadId"
            @placeholder={{t "incidents.form.placeholders.technicalLeadId"}}
            class="col-span-12 md:col-span-6"
          />
        {{/if}}

        {{#if this.showStepDescription}}
          <h2 class="col-span-12 text-lg font-semibold">{{t
              "incidents.form.steps.description"
            }}</h2>
          <F.TpkTextareaPrefab
            @label={{t "incidents.form.description"}}
            @validationField="description"
            @placeholder={{t "incidents.form.placeholders.description"}}
            class="col-span-12"
          />
          <div class="col-span-12">
            <IncidentDescriptionSectionsEditor
              @items={{this.descriptionSections}}
              @onChange={{fn this.setArrayField "descriptionSections"}}
            />
          </div>
        {{/if}}

        {{#if this.showStepImpact}}
          <h2 class="col-span-12 text-lg font-semibold">{{t
              "incidents.form.steps.impact"
            }}</h2>
          <F.TpkCheckboxPrefab
            @label={{t "incidents.form.personalDataImpacted"}}
            @validationField="personalDataImpacted"
            class="col-span-12 md:col-span-6"
          />
          <F.TpkCheckboxPrefab
            @label={{t "incidents.form.specialCategoryData"}}
            @validationField="specialCategoryData"
            class="col-span-12 md:col-span-6"
          />
          <F.TpkCheckboxPrefab
            @label={{t "incidents.form.apdNotificationRequired"}}
            @validationField="apdNotificationRequired"
            class="col-span-12 md:col-span-6"
          />
          <F.TpkTextareaPrefab
            @label={{t "incidents.form.impactSummary"}}
            @validationField="impactSummary"
            @placeholder={{t "incidents.form.placeholders.impactSummary"}}
            class="col-span-12"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.severityOperational"}}
            @validationField="severityOperational"
            @options={{this.severityOptions}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-4"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.severityCompliance"}}
            @validationField="severityCompliance"
            @options={{this.severityOptions}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-4"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.severityOverall"}}
            @validationField="severityOverall"
            @options={{this.severityOptions}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-4"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.affectedPersonsCount"}}
            @validationField="affectedPersonsCount"
            @placeholder={{t
              "incidents.form.placeholders.affectedPersonsCount"
            }}
            class="col-span-12 md:col-span-6"
          />
          <F.TpkInputPrefab
            @label={{t "incidents.form.affectedPatientsCount"}}
            @validationField="affectedPatientsCount"
            @placeholder={{t
              "incidents.form.placeholders.affectedPatientsCount"
            }}
            class="col-span-12 md:col-span-6"
          />
        {{/if}}

        {{#if this.showStepTimeline}}
          <h2 class="col-span-12 text-lg font-semibold">{{t
              "incidents.form.steps.timeline"
            }}</h2>
          <div class="col-span-12">
            <IncidentTimelineEditor
              @items={{this.timelineEvents}}
              @onChange={{fn this.setArrayField "timelineEvents"}}
            />
          </div>
        {{/if}}

        {{#if this.showStepMeasures}}
          <h2 class="col-span-12 text-lg font-semibold">{{t
              "incidents.form.steps.measures"
            }}</h2>
          <F.TpkTextareaPrefab
            @label={{t "incidents.form.immediateCause"}}
            @validationField="immediateCause"
            @placeholder={{t "incidents.form.placeholders.immediateCause"}}
            class="col-span-12"
          />
          <div class="col-span-12">
            <IncidentStringListEditor
              @label={{t "incidents.form.contributingFactors"}}
              @items={{this.contributingFactors}}
              @onChange={{fn this.setArrayField "contributingFactors"}}
              @placeholder={{t
                "incidents.form.placeholders.contributingFactor"
              }}
            />
          </div>
          <div class="col-span-12">
            <IncidentCorrectiveActionsEditor
              @items={{this.correctiveActions}}
              @onChange={{fn this.setArrayField "correctiveActions"}}
            />
          </div>
          <div class="col-span-12">
            <IncidentStringListEditor
              @label={{t "incidents.form.preventiveMeasures"}}
              @items={{this.preventiveMeasures}}
              @onChange={{fn this.setArrayField "preventiveMeasures"}}
              @placeholder={{t "incidents.form.placeholders.preventiveMeasure"}}
            />
          </div>
        {{/if}}

        {{#if this.showStepClosing}}
          <h2 class="col-span-12 text-lg font-semibold">{{t
              "incidents.form.steps.closing"
            }}</h2>
          <F.TpkTextareaPrefab
            @label={{t "incidents.form.conclusion"}}
            @validationField="conclusion"
            @placeholder={{t "incidents.form.placeholders.conclusion"}}
            class="col-span-12"
          />
          <p class="col-span-12 text-sm text-base-content/70">{{t
              "incidents.form.hints.communicationPlan"
            }}</p>
        {{/if}}

        {{#if this.showStepSignatures}}
          <h2 class="col-span-12 text-lg font-semibold">{{t
              "incidents.form.steps.signatures"
            }}</h2>
          <div class="col-span-12">
            <IncidentAccessLogsEditor
              @items={{this.accessLogs}}
              @onChange={{fn this.setArrayField "accessLogs"}}
            />
          </div>
          <label class="col-span-12 md:col-span-6 flex flex-col gap-1">
            <span class="text-sm font-medium">{{t
                "incidents.form.issuerSignatureName"
              }}</span>
            <input
              type="text"
              class="input input-bordered w-full rounded-none"
              value={{this.issuerSignature.name}}
              {{on "input" (fn this.updateSignature "issuerSignature" "name")}}
            />
          </label>
          <label class="col-span-12 md:col-span-6 flex flex-col gap-1">
            <span class="text-sm font-medium">{{t
                "incidents.form.issuerSignatureDate"
              }}</span>
            <input
              type="text"
              class="input input-bordered w-full rounded-none"
              value={{this.issuerSignature.date}}
              placeholder={{t "incidents.form.placeholders.signatureDate"}}
              {{on "input" (fn this.updateSignature "issuerSignature" "date")}}
            />
          </label>
          <label class="col-span-12 md:col-span-6 flex flex-col gap-1">
            <span class="text-sm font-medium">{{t
                "incidents.form.recipientSignatureName"
              }}</span>
            <input
              type="text"
              class="input input-bordered w-full rounded-none"
              value={{this.recipientSignature.name}}
              {{on
                "input"
                (fn this.updateSignature "recipientSignature" "name")
              }}
            />
          </label>
          <label class="col-span-12 md:col-span-6 flex flex-col gap-1">
            <span class="text-sm font-medium">{{t
                "incidents.form.recipientSignatureDate"
              }}</span>
            <input
              type="text"
              class="input input-bordered w-full rounded-none"
              value={{this.recipientSignature.date}}
              placeholder={{t "incidents.form.placeholders.signatureDate"}}
              {{on
                "input"
                (fn this.updateSignature "recipientSignature" "date")
              }}
            />
          </label>
        {{/if}}

        <div class="col-span-12 flex items-center justify-between gap-2 mt-4">
          <div class="flex gap-2">
            {{#unless this.isFirstStep}}
              <button
                type="button"
                class="btn btn-outline"
                {{on "click" this.previousStep}}
                data-test-incident-prev
              >
                {{t "incidents.form.actions.previous"}}
              </button>
            {{/unless}}
            {{#unless this.isLastStep}}
              <button
                type="button"
                class="btn btn-primary"
                {{on "click" this.nextStep}}
                data-test-incident-next
              >
                {{t "incidents.form.actions.next"}}
              </button>
            {{/unless}}
            {{#if this.isLastStep}}
              <button
                type="submit"
                class="btn btn-primary"
                data-test-incident-submit
              >
                {{t "incidents.form.submit"}}
              </button>
            {{/if}}
          </div>
          <LinkTo
            @route="dashboard.incidents"
            class="text-sm text-primary underline"
          >
            {{t "incidents.form.cancel"}}
          </LinkTo>
        </div>
      </div>
    </TpkForm>
  </template>
}
