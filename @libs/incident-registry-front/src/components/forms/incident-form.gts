import Component from '@glimmer/component';
import { action } from '@ember/object';
import { cached, tracked } from '@glimmer/tracking';
import TpkForm from '@triptyk/ember-input-validation/components/tpk-form';
import { RowInput } from '#src/components/forms/incident-row-fields.gts';
import { service } from '@ember/service';
import type IncidentService from '#src/services/incident.ts';
import type { IncidentChangeset } from '#src/changesets/incident.ts';
import {
  createIncidentValidationSchema,
  INCIDENT_FORM_STEPS,
  type IncidentFormStep,
  stepForField,
  stepIndex,
  validateIncidentStep,
  type ValidatedIncident,
} from '#src/components/forms/incident-validation.ts';
import { normalizeIncidentPayload } from '#src/components/forms/incident-payload.ts';
import {
  firstInvalidStep,
  invalidFieldLabels,
  issuesToStepFields,
} from '#src/components/forms/incident-step-errors.ts';
import ArrowLeftIcon from '@libs/shared-front/assets/icons/arrow-left';
import {
  classificationLabelKey,
  environmentLabelKey,
  INCIDENT_CLASSIFICATIONS,
  INCIDENT_ENVIRONMENTS,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  labelledOption,
  optionLabel,
  severityLabelKey,
  statusLabelKey,
  type LabelledOption,
} from '#src/utils/incident-options.ts';
import {
  codeOf,
  selectedOptionComponent,
} from '#src/components/forms/incident-select-label.gts';
import type { ZodIssue } from 'zod';
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
  // 'create' (défaut) ou 'edit'. En édition, le submit appelle
  // `incident.update(incidentId, …)` (nouvelle version côté backend).
  mode?: 'create' | 'edit';
  incidentId?: string;
}

// Changing step swaps the whole panel: without this the browser keeps the
// scroll offset of the previous (often much longer) step and the user lands
// mid-form, on no field in particular.
function scrollWizardToTop(): void {
  requestAnimationFrame(() => {
    document
      .querySelector('[data-test-incident-form]')
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

export default class IncidentForm extends Component<IncidentFormArgs> {
  @service declare incident: IncidentService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;
  @service declare handleSave: HandleSaveService;

  @tracked currentStepIndex = 0;
  @tracked stepErrorMessage = '';

  // Furthest step the user has validated: the step indicator only lets them
  // jump back to a step they already passed, so clicking it can never skip a
  // step's validation. In edit mode every field is pre-filled from an existing
  // incident, so the whole wizard is navigable from the start — forcing a DPO
  // to walk 8 steps again to fix one typo would be absurd.
  @tracked furthestStepIndex =
    this.args.mode === 'edit' ? INCIDENT_FORM_STEPS.length - 1 : 0;

  // Stored value = the stable code, displayed value = its translation.
  // `@cached` keeps the option objects identity-stable across re-renders, which
  // power-select needs to match `@selected` against an element of `@options`.
  @cached
  get classificationOptions(): LabelledOption[] {
    return INCIDENT_CLASSIFICATIONS.map((code) =>
      labelledOption(code, optionLabel(code, classificationLabelKey, this.intl))
    );
  }

  @cached
  get statusOptions(): LabelledOption[] {
    return INCIDENT_STATUSES.map((code) =>
      labelledOption(code, optionLabel(code, statusLabelKey, this.intl))
    );
  }

  @cached
  get environmentOptions(): LabelledOption[] {
    return INCIDENT_ENVIRONMENTS.map((code) =>
      labelledOption(code, optionLabel(code, environmentLabelKey, this.intl))
    );
  }

  @cached
  get severityOptions(): LabelledOption[] {
    return INCIDENT_SEVERITIES.map((code) =>
      labelledOption(code, optionLabel(code, severityLabelKey, this.intl))
    );
  }

  // Renders the label (not the code) inside each select's trigger.
  classificationSelectedItem = selectedOptionComponent(
    () => this.classificationOptions
  );
  statusSelectedItem = selectedOptionComponent(() => this.statusOptions);
  environmentSelectedItem = selectedOptionComponent(
    () => this.environmentOptions
  );
  severitySelectedItem = selectedOptionComponent(() => this.severityOptions);

  // power-select emits the option object; only its code is persisted.
  @action
  setOptionField(field: string, selection: unknown) {
    this.args.changeset.set(field, codeOf(selection));
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

  // Les conversions vivent dans `incident-payload.ts` : elles sont pures, et
  // seules des fonctions pures peuvent être testées sans rendre les 8 étapes.
  // Le POURQUOI de leur existence est documenté là-bas.
  private normalizePayload(data: ValidatedIncident): ValidatedIncident {
    return normalizeIncidentPayload(data);
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

  get stepItems(): {
    index: number;
    label: string;
    complete: boolean;
    current: boolean;
    reachable: boolean;
  }[] {
    return this.stepLabels.map((label, index) => ({
      index,
      label,
      complete: index <= this.currentStepIndex,
      current: index === this.currentStepIndex,
      reachable: index <= this.furthestStepIndex,
    }));
  }

  get stepProgress(): string {
    return this.intl.t('incidents.form.stepProgress', {
      current: this.currentStepIndex + 1,
      total: INCIDENT_FORM_STEPS.length,
    });
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

  // @lat: [[frontend/forms#Stocker un Date, pas une string, pendant l'édition]]
  // Store the raw Date (not an ISO string): TpkDatepickerPrefab re-feeds this
  // value to tempus-dominus on every re-render, and a string forces it back
  // through DateTime.fromString (crash-prone, and always logs "TD: Using a
  // string for date options..."). incident-validation.ts converts to ISO for
  // the `z.string().datetime()` fields in the actual submitted payload.
  // DraftIncident declares these fields as string (see @lat above) to satisfy
  // TpkForm's changeset<->schema type coupling; `field: string` (not a keyof
  // literal) already widens `.set()`'s value type, so no cast needed here.
  @action
  setDateField(field: string, dates: Date[]) {
    this.args.changeset.set(field, dates[0] ?? null);
  }

  // @lat: [[frontend/forms#Prefabs vs composants standalone]]
  @action
  updateSignature(
    which: 'issuerSignature' | 'recipientSignature',
    field: 'name' | 'date',
    value: string | number | Date | null
  ) {
    const current = this.args.changeset.get(which) ?? {
      name: '',
      date: '',
    };
    // `<input type="date">` remonte un Date via `valueAsDate` : sans
    // normalisation la signature stockerait « Thu Aug 20 2026 00:00:00 GMT… ».
    const normalized =
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value ?? '');
    this.args.changeset.set(which, {
      ...current,
      [field]: normalized,
    });
  }

  // Push one changeset error per failing field so each input shows its own
  // inline message, exactly as TpkForm does on submit. Before this the step
  // only got a single alert concatenating Zod's raw English messages
  // ("Invalid input: expected string, received undefined · …") with no way to
  // tell WHICH of the twelve fields on the step was at fault.
  private applyStepIssues(issues: ZodIssue[]): void {
    for (const { path, message } of issuesToStepFields(issues)) {
      this.args.changeset.removeError(path);
      this.args.changeset.addError({
        key: path,
        message,
        value: undefined,
        originalValue: '',
      });
    }
  }

  // Libellé humain d'une étape. `fieldLabel` ne convient pas ici : il résout
  // `incidents.form.<step>`, clé qui n'existe pas — la bannière affichait donc
  // le code brut (« impact ») au lieu de « Impact (§4) ».
  private stepLabel(step: IncidentFormStep): string {
    return this.intl.t(`incidents.form.steps.${step}`);
  }

  private describeInvalidFields(issues: ZodIssue[]): string {
    return this.intl.t('incidents.form.errors.requiredFields', {
      fields: invalidFieldLabels(issues, this.intl).join(', '),
    });
  }

  @action
  previousStep() {
    this.stepErrorMessage = '';
    if (this.currentStepIndex > 0) {
      this.currentStepIndex -= 1;
      scrollWizardToTop();
    }
  }

  // Jump straight to an already-validated step from the indicator.
  @action
  goToStep(index: number) {
    if (index === this.currentStepIndex || index > this.furthestStepIndex) {
      return;
    }
    this.stepErrorMessage = '';
    this.currentStepIndex = index;
    scrollWizardToTop();
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
        this.applyStepIssues(result.issues);
        this.stepErrorMessage = this.describeInvalidFields(result.issues);
        return;
      }
      if (this.currentStepIndex < INCIDENT_FORM_STEPS.length - 1) {
        this.currentStepIndex += 1;
        this.furthestStepIndex = Math.max(
          this.furthestStepIndex,
          this.currentStepIndex
        );
        scrollWizardToTop();
      }
    } catch (error) {
      console.error('validateIncidentStep failed', error);
      this.stepErrorMessage = this.intl.t(
        'incidents.form.errors.stepValidation'
      );
    }
  }

  // Runs on the submit button's click, BEFORE the form's own submit handler.
  //
  // TpkForm validates the whole schema and, when it fails, aborts the submit
  // silently — on a wizard the offending field almost always belongs to a step
  // that is not rendered, so the user clicks "Save incident" and nothing
  // happens at all, with no message anywhere. We walk the steps ourselves and
  // bring them back to the first one that actually blocks; TpkForm then fills
  // in the inline field errors on that now-visible step.
  @action
  checkStepsBeforeSubmit() {
    let failing;
    try {
      failing = firstInvalidStep(this.snapshotChangeset(), this.intl);
    } catch (error) {
      console.error('validateIncidentStep failed', error);
      this.stepErrorMessage = this.intl.t(
        'incidents.form.errors.stepValidation'
      );
      return;
    }
    if (!failing) {
      this.stepErrorMessage = '';
      return;
    }
    const jumped = failing.index !== this.currentStepIndex;
    this.applyStepIssues(failing.issues);
    this.stepErrorMessage = jumped
      ? this.intl.t('incidents.form.errors.otherStepInvalid', {
          step: this.stepLabel(failing.step),
        })
      : this.describeInvalidFields(failing.issues);
    this.currentStepIndex = failing.index;
    this.furthestStepIndex = Math.max(this.furthestStepIndex, failing.index);
    scrollWizardToTop();
  }

  get isEditMode(): boolean {
    return this.args.mode === 'edit';
  }

  onSubmit = async (
    data: ValidatedIncident,
    c: ImmerChangeset<ValidatedIncident>
  ) => {
    const normalized = this.normalizePayload(data);
    const incidentId = this.args.incidentId;
    await this.handleSave.handleSave({
      saveAction: () =>
        this.isEditMode && incidentId
          ? this.incident.update(incidentId, normalized)
          : this.incident.create(normalized),
      changeset: c,
      successMessage: this.isEditMode
        ? 'incidents.form.updateSuccess'
        : 'incidents.form.success',
      transitionOnSuccess: 'dashboard.incidents',
    });
    this.revealServerFieldErrors(c);
  };

  // Filet de sécurité pour les refus VENANT DU SERVEUR.
  //
  // `HandleSaveService` classe toute erreur JSON:API portant un pointer
  // `/data/attributes/...` en erreur de CHAMP : elle est poussée dans le
  // changeset et, volontairement, ne produit AUCUN flash. Sur un wizard le
  // champ visé appartient presque toujours à une étape non rendue — un 400
  // `MISSING_IMPACT_FIELDS` pointe `severityOverall` (étape 4) alors qu'on
  // soumet depuis l'étape 8 — donc l'erreur existait sans être affichable
  // nulle part : « enregistrer » ne faisait visiblement rien, et l'incident
  // n'était pas créé.
  //
  // On ramène l'utilisateur sur la première étape concernée, où TpkForm rend
  // déjà l'erreur inline du champ. Aligner la validation front sur les règles
  // métier du backend reste la vraie défense (voir `refineArt9Impact`) ; ceci
  // couvre toute règle serveur que le front ne reproduit pas encore.
  private revealServerFieldErrors(c: ImmerChangeset<ValidatedIncident>): void {
    const indices: number[] = [];
    for (const changesetError of c.errors) {
      // Tolère les deux séparateurs : le wizard pousse des clés pointées
      // (`correctiveActions.0.title`) et une erreur serveur peut arriver avec
      // un reste de pointer JSON:API si un module contourne HandleSaveService.
      const root = String(changesetError.key).split(/[./]/)[0] ?? '';
      const step = stepForField(root);
      if (step) {
        indices.push(stepIndex(step));
      }
    }
    if (!indices.length) {
      return;
    }
    const target = Math.min(...indices);
    const step = INCIDENT_FORM_STEPS[target];
    this.stepErrorMessage = this.intl.t(
      'incidents.form.errors.serverFieldError',
      { step: step ? this.stepLabel(step) : '' }
    );
    this.currentStepIndex = target;
    this.furthestStepIndex = Math.max(this.furthestStepIndex, target);
    scrollWizardToTop();
  }

  <template>
    <TpkForm
      @changeset={{@changeset}}
      @onSubmit={{this.onSubmit}}
      @validationSchema={{@validationSchema}}
      data-test-incident-form
      as |F|
    >
      {{! `min-w-28` per step + horizontal scroll: DaisyUI's .step is 4rem
      wide, so the longer labels ("Communication & conclusion (§8–§9)") used to
      overlap their neighbour and render as unreadable overlapping text. }}
      <ol class="steps steps-horizontal w-full mb-2 overflow-x-auto">
        {{#each this.stepItems as |step|}}
          <li
            class="step min-w-28 {{if step.complete 'step-primary'}}"
            data-test-incident-step={{step.index}}
            aria-current={{if step.current "step"}}
          >
            {{#if step.reachable}}
              {{! Only validated steps are clickable, so navigating back and
              forth through the indicator can never skip a step's gate. }}
              <button
                type="button"
                class="btn btn-ghost btn-xs h-auto min-h-0 whitespace-normal px-1 py-1 font-normal
                  {{if step.current 'font-semibold'}}"
                {{on "click" (fn this.goToStep step.index)}}
                data-test-incident-step-link={{step.index}}
              >
                {{step.label}}
              </button>
            {{else}}
              <span class="whitespace-normal px-1 text-base-content/60">
                {{step.label}}
              </span>
            {{/if}}
          </li>
        {{/each}}
      </ol>
      <p
        class="mb-4 text-sm text-base-content/70"
        aria-live="polite"
        data-test-incident-step-progress
      >
        {{this.stepProgress}}
      </p>

      {{#if this.stepErrorMessage}}
        {{! Explicit utilities rather than DaisyUI's `alert alert-error`: that
        component class renders with no background and no color here (the app's
        Tailwind build does not emit it), so the banner was an invisible blank
        block above the step. }}
        <div
          class="mb-4 rounded border border-error/40 bg-error/10 px-3 py-2 text-sm text-error"
          role="alert"
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
          <F.TpkDatepickerPrefab
            @label={{t "incidents.form.reportDate"}}
            @validationField="reportDate"
            @onChange={{fn this.setDateField "reportDate"}}
            @dateFormat="yyyy-MM-dd[T]HH:mm:ss[Z]"
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
            @onChange={{fn this.setOptionField "classification"}}
            @selectedItemComponent={{this.classificationSelectedItem}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-4"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.status"}}
            @validationField="status"
            @options={{this.statusOptions}}
            @onChange={{fn this.setOptionField "status"}}
            @selectedItemComponent={{this.statusSelectedItem}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-4"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.environment"}}
            @validationField="environment"
            @options={{this.environmentOptions}}
            @onChange={{fn this.setOptionField "environment"}}
            @selectedItemComponent={{this.environmentSelectedItem}}
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
          <F.TpkDatepickerPrefab
            @label={{t "incidents.form.incidentStartAt"}}
            @validationField="incidentStartAt"
            @onChange={{fn this.setDateField "incidentStartAt"}}
            @dateFormat="yyyy-MM-dd[T]HH:mm:ss[Z]"
            class="col-span-12 md:col-span-6"
          />
          <F.TpkDatepickerPrefab
            @label={{t "incidents.form.incidentEndAt"}}
            @validationField="incidentEndAt"
            @onChange={{fn this.setDateField "incidentEndAt"}}
            @dateFormat="yyyy-MM-dd[T]HH:mm:ss[Z]"
            class="col-span-12 md:col-span-6"
          />
          <F.TpkDatepickerPrefab
            @label={{t "incidents.form.detectedAt"}}
            @validationField="detectedAt"
            @onChange={{fn this.setDateField "detectedAt"}}
            @dateFormat="yyyy-MM-dd[T]HH:mm:ss[Z]"
            class="col-span-12 md:col-span-6"
          />
          <F.TpkDatepickerPrefab
            @label={{t "incidents.form.resolvedAt"}}
            @validationField="resolvedAt"
            @onChange={{fn this.setDateField "resolvedAt"}}
            @dateFormat="yyyy-MM-dd[T]HH:mm:ss[Z]"
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
            @onChange={{fn this.setOptionField "severityOperational"}}
            @selectedItemComponent={{this.severitySelectedItem}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-4"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.severityCompliance"}}
            @validationField="severityCompliance"
            @options={{this.severityOptions}}
            @onChange={{fn this.setOptionField "severityCompliance"}}
            @selectedItemComponent={{this.severitySelectedItem}}
            @placeholder={{t "incidents.form.placeholders.select"}}
            class="col-span-12 md:col-span-4"
          />
          <F.TpkSelectPrefab
            @label={{t "incidents.form.severityOverall"}}
            @validationField="severityOverall"
            @options={{this.severityOptions}}
            @onChange={{fn this.setOptionField "severityOverall"}}
            @selectedItemComponent={{this.severitySelectedItem}}
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
          {{! RowInput, pas <TpkInput /> auto-fermant : TpkInput est contextuel
          et ne rend rien sans bloc — ces quatre champs de signature étaient
          absents du DOM (voir incident-row-fields.gts). }}
          <div class="col-span-12 md:col-span-6">
            <RowInput
              @label={{t "incidents.form.issuerSignatureName"}}
              @value={{this.issuerSignature.name}}
              @onChange={{fn this.updateSignature "issuerSignature" "name"}}
              data-test-issuer-signature-name
            />
          </div>
          <div class="col-span-12 md:col-span-6">
            <RowInput
              @label={{t "incidents.form.issuerSignatureDate"}}
              @value={{this.issuerSignature.date}}
              @type="date"
              @placeholder={{t "incidents.form.placeholders.signatureDate"}}
              @onChange={{fn this.updateSignature "issuerSignature" "date"}}
              data-test-issuer-signature-date
            />
          </div>
          <div class="col-span-12 md:col-span-6">
            <RowInput
              @label={{t "incidents.form.recipientSignatureName"}}
              @value={{this.recipientSignature.name}}
              @onChange={{fn this.updateSignature "recipientSignature" "name"}}
              data-test-recipient-signature-name
            />
          </div>
          <div class="col-span-12 md:col-span-6">
            <RowInput
              @label={{t "incidents.form.recipientSignatureDate"}}
              @value={{this.recipientSignature.date}}
              @type="date"
              @placeholder={{t "incidents.form.placeholders.signatureDate"}}
              @onChange={{fn this.updateSignature "recipientSignature" "date"}}
              data-test-recipient-signature-date
            />
          </div>
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
              {{! The click handler pre-flights every step and jumps to the
              first invalid one; TpkForm's own submit handler then aborts and
              fills in that step's inline field errors. Without it, an invalid
              field on an earlier step makes this button do nothing visible. }}
              <button
                type="submit"
                class="btn btn-primary"
                {{on "click" this.checkStepsBeforeSubmit}}
                data-test-incident-submit
              >
                {{t "incidents.form.submit"}}
              </button>
            {{/if}}
          </div>
          <LinkTo
            @route="dashboard.incidents"
            class="inline-flex items-center gap-1 text-sm text-primary underline"
          >
            <ArrowLeftIcon class="size-4" />
            {{t "incidents.form.cancel"}}
          </LinkTo>
        </div>
      </div>
    </TpkForm>
  </template>
}
