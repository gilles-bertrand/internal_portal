import { z } from 'zod';
import type IntlService from 'ember-intl/services/intl';
import {
  INCIDENT_CLASSIFICATIONS,
  INCIDENT_ENVIRONMENTS,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
} from '#src/utils/incident-options.ts';

// Single source of truth for the four business enums: the schema and the
// display layer (table filters, wizard selects) must never drift apart.
const CLASSIFICATIONS = INCIDENT_CLASSIFICATIONS;
const STATUSES = INCIDENT_STATUSES;
const ENVIRONMENTS = INCIDENT_ENVIRONMENTS;
const SEVERITIES = INCIDENT_SEVERITIES;

// Validation messages are built from the field's OWN label key rather than one
// hard-coded key per field (access-record-validation.ts's approach): the
// incident schema has ~40 fields, and a per-field key set would drift from the
// labels the form already shows. `intl.t` is used without `intl.exists` on
// purpose — every label key exists (checked in the unit test) and unit tests
// stub intl with a bare `t`.
function label(intl: IntlService, field: string): string {
  return intl.t(FIELD_LABEL_KEYS[field] ?? `incidents.form.${field}`);
}

function required(intl: IntlService, field: string): string {
  return intl.t('incidents.form.validation.required', {
    field: label(intl, field),
  });
}

function invalidDate(intl: IntlService, field: string): string {
  return intl.t('incidents.form.validation.invalidDate', {
    field: label(intl, field),
  });
}

// Fields whose label lives under another key than `incidents.form.<field>`.
// Mirrors incident-step-errors.ts's alias table, kept local to avoid a cycle
// (that module imports this one).
const FIELD_LABEL_KEYS: Record<string, string> = {
  descriptionSections: 'incidents.form.sections.descriptionBlocks',
  timelineEvents: 'incidents.form.sections.timeline',
  correctiveActions: 'incidents.form.sections.correctiveActions',
  accessLogs: 'incidents.form.sections.accessLogs',
  issuerSignature: 'incidents.form.issuerSignatureName',
  recipientSignature: 'incidents.form.recipientSignatureName',
};

const optionalSeverity = z
  .union([z.enum(SEVERITIES), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const INCIDENT_FORM_STEPS = [
  'header',
  'context',
  'description',
  'impact',
  'timeline',
  'measures',
  'closing',
  'signatures',
] as const;

export type IncidentFormStep = (typeof INCIDENT_FORM_STEPS)[number];

const TimelineEventSchema = z.object({
  date: z.string().min(1),
  time: z.string().min(1),
  event: z.string().min(1),
});

// `items` n'est éditable par aucun écran, mais un bloc créé par API ou par seed
// en porte : déclaré ici pour qu'il traverse la validation au lieu d'être
// silencieusement écarté sur le chemin de l'édition.
const DescriptionSectionSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  items: z.array(z.string()).optional(),
});

const CorrectiveActionSchema = z.object({
  phase: z.string().optional(),
  order: z.number().int(),
  title: z.string().min(1),
  detail: z.string().min(1),
  completedAt: z.string().optional(),
});

const AccessLogSchema = z.object({
  date: z.string().min(1),
  user: z.string().min(1),
  email: z.string().min(1),
  files: z.string().min(1),
  count: z.coerce.number().int(),
});

const CommunicationEntrySchema = z.object({
  audience: z.string().min(1),
  channel: z.string().min(1),
  message: z.string().min(1),
});

const SignatureSchema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
});

const optionalDatetime = z
  .union([z.string().datetime(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

// @lat: [[frontend/forms#Stocker un Date, pas une string, pendant l'édition]]
// The changeset holds a Date while editing these 5 fields (see DraftIncident);
// convert to ISO here so the validated/submitted payload stays a proper ISO
// string for the backend contract. Strings pass through unchanged.
const dateInputToIso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : value;
const optionalDatetimeInput = z.preprocess(dateInputToIso, optionalDatetime);

// ORDRE DES MEMBRES SIGNIFICATIF. `z.coerce.number()` accepte `null` et le
// coerce en **0** (`Number(null) === 0`), et `''` en 0 aussi : avec le membre
// coercitif en tête, un compteur laissé vide était persisté comme « 0 personne
// concernée » — une affirmation factuelle fausse dans un registre RGPD, là où la
// CNIL demande un nombre *approximatif* et où « non déterminé » est une réponse
// valide. Effet de bord : la règle art. 9 du backend (« au moins un compteur
// non nul ») était toujours satisfaite artificiellement. En plaçant `null` et
// `''` d'abord, un champ vide reste bien `null`.
const optionalInt = z
  .union([z.null(), z.literal(''), z.coerce.number().int()])
  .optional()
  .transform((value) =>
    value === '' || value === null || value === undefined ? null : value
  );

const optionalString = z
  .union([z.string(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

function createIncidentBaseSchema(intl: IntlService) {
  const text = (field: string) =>
    z.string(required(intl, field)).min(1, required(intl, field));
  const date = (field: string) =>
    z.preprocess(
      dateInputToIso,
      z.string(required(intl, field)).datetime(invalidDate(intl, field))
    );

  return z.object({
    reportDate: date('reportDate'),
    version: text('version'),
    classification: z.enum(CLASSIFICATIONS, required(intl, 'classification')),
    status: z.enum(STATUSES, required(intl, 'status')),
    applicationName: text('applicationName'),
    applicationDetail: text('applicationDetail'),
    environment: z.enum(ENVIRONMENTS, required(intl, 'environment')),
    clientCode: text('clientCode'),
    clientName: text('clientName'),
    reportedBy: text('reportedBy'),
    recipientName: text('recipientName'),
    recipientOrg: text('recipientOrg'),
    legalContext: text('legalContext'),
    serviceName: text('serviceName'),
    deployedVersion: text('deployedVersion'),
    incidentStartAt: date('incidentStartAt'),
    incidentEndAt: optionalDatetimeInput,
    detectedAt: date('detectedAt'),
    resolvedAt: optionalDatetimeInput,
    resolutionDurationMinutes: optionalInt,
    technicalLeadId: optionalString,
    description: text('description'),
    descriptionSections: z.array(DescriptionSectionSchema).optional(),
    personalDataImpacted: z.boolean(required(intl, 'personalDataImpacted')),
    specialCategoryData: z.boolean(required(intl, 'specialCategoryData')),
    apdNotificationRequired: z.boolean().optional().nullable(),
    impactSummary: text('impactSummary'),
    severityOperational: optionalSeverity,
    severityCompliance: optionalSeverity,
    severityOverall: optionalSeverity,
    affectedPersonsCount: optionalInt,
    affectedPatientsCount: optionalInt,
    immediateCause: text('immediateCause'),
    contributingFactors: z.array(z.string().min(1)),
    correctiveActions: z.array(CorrectiveActionSchema),
    preventiveMeasures: z.array(z.string().min(1)),
    communicationPlan: z.array(CommunicationEntrySchema).optional(),
    conclusion: text('conclusion'),
    timelineEvents: z
      .array(TimelineEventSchema, required(intl, 'timelineEvents'))
      .min(1, required(intl, 'timelineEvents')),
    accessLogs: z.array(AccessLogSchema).optional().nullable(),
    issuerSignature: SignatureSchema.optional().nullable(),
    recipientSignature: SignatureSchema.optional().nullable(),
  });
}

// Cross-field rules, factored out so the full schema and the per-step gate
// cannot drift apart: a rule the wizard enforces on step N must be the same one
// the final submit enforces. Messages go through intl — they used to be
// hard-coded French strings, shown as-is inside the English UI.
interface RefineCtx {
  addIssue(issue: {
    code: 'custom';
    message: string;
    path: (string | number)[];
  }): void;
}

// Reproduit EXACTEMENT `validateIncidentBusinessRules` du backend
// (@libs/incident-registry-backend/src/utils/incident-attributes.ts) pour les
// données art. 9. Le front se contentait auparavant de « impactSummary OU un
// compteur non nul » — règle morte, puisque `impactSummary` est de toute façon
// obligatoire — pendant que le backend exigeait EN PLUS `severityOverall` ET
// `severityCompliance`. Conséquence : le wizard laissait passer les huit
// étapes, l'API répondait 400 MISSING_IMPACT_FIELDS avec un pointer
// `/data/attributes/severityOverall`, HandleSaveService le classait en erreur
// de CHAMP (donc aucun flash) et ce champ appartient à l'étape 4, non rendue
// depuis l'étape 8 : l'utilisateur cliquait « enregistrer » et il ne se
// passait strictement rien. Ces trois règles bloquent désormais à l'étape 4,
// champ par champ.
export function refineArt9Impact(
  values: {
    specialCategoryData?: boolean | null;
    impactSummary?: string | null;
    severityOverall?: string | null;
    severityCompliance?: string | null;
    affectedPersonsCount?: number | null;
    affectedPatientsCount?: number | null;
  },
  ctx: RefineCtx,
  intl: IntlService
): void {
  if (!values.specialCategoryData) {
    return;
  }
  if ((values.impactSummary ?? '').trim().length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: intl.t('incidents.form.validation.art9Impact'),
      path: ['impactSummary'],
    });
  }
  if (!values.severityOverall) {
    ctx.addIssue({
      code: 'custom',
      message: intl.t('incidents.form.validation.art9SeverityOverall'),
      path: ['severityOverall'],
    });
  }
  if (!values.severityCompliance) {
    ctx.addIssue({
      code: 'custom',
      message: intl.t('incidents.form.validation.art9SeverityCompliance'),
      path: ['severityCompliance'],
    });
  }
  // Le backend teste `== null` : un compteur à 0 est une valeur légitime
  // (« aucun patient concerné »), on ne l'exige donc pas strictement positif.
  if (
    values.affectedPersonsCount == null &&
    values.affectedPatientsCount == null
  ) {
    ctx.addIssue({
      code: 'custom',
      message: intl.t('incidents.form.validation.art9AffectedCount'),
      path: ['affectedPersonsCount'],
    });
  }
}

export function refineIncidentDates(
  values: {
    detectedAt?: string | null;
    resolvedAt?: string | null;
    incidentStartAt?: string | null;
    incidentEndAt?: string | null;
  },
  ctx: RefineCtx,
  intl: IntlService
): void {
  if (
    values.detectedAt &&
    values.resolvedAt &&
    values.resolvedAt < values.detectedAt
  ) {
    ctx.addIssue({
      code: 'custom',
      message: intl.t('incidents.form.validation.resolvedBeforeDetected'),
      path: ['resolvedAt'],
    });
  }
  // The backend rejects this with 400 INCOHERENT_DATES; the front never
  // checked it, so the user only found out after a failed round trip.
  // See [[frontend/incident-registry-contract-gaps]].
  if (
    values.incidentStartAt &&
    values.incidentEndAt &&
    values.incidentEndAt < values.incidentStartAt
  ) {
    ctx.addIssue({
      code: 'custom',
      message: intl.t('incidents.form.validation.endBeforeStart'),
      path: ['incidentEndAt'],
    });
  }
}

export function createIncidentValidationSchema(intl: IntlService) {
  return createIncidentBaseSchema(intl).superRefine((data, ctx) => {
    refineArt9Impact(data, ctx, intl);
    refineIncidentDates(data, ctx, intl);
  });
}

export type ValidatedIncident = z.infer<
  ReturnType<typeof createIncidentValidationSchema>
>;

// Exported so the wizard can map a failing field back to the step that owns
// it: on submit, TpkForm validates the WHOLE schema, and a field living on
// another step is not rendered — without this mapping the form aborts the
// submit with no visible reason (see incident-form.gts).
export const INCIDENT_STEP_FIELDS: Record<
  IncidentFormStep,
  (keyof ValidatedIncident)[]
> = {
  header: [
    'clientCode',
    'clientName',
    'applicationName',
    'applicationDetail',
    'reportedBy',
    'reportDate',
    'version',
    'classification',
    'status',
    'environment',
    'recipientName',
    'recipientOrg',
  ],
  context: [
    'legalContext',
    'serviceName',
    'deployedVersion',
    'incidentStartAt',
    'incidentEndAt',
    'detectedAt',
    'resolvedAt',
    'resolutionDurationMinutes',
    'technicalLeadId',
  ],
  description: ['description', 'descriptionSections'],
  impact: [
    'personalDataImpacted',
    'specialCategoryData',
    'apdNotificationRequired',
    'impactSummary',
    'severityOperational',
    'severityCompliance',
    'severityOverall',
    'affectedPersonsCount',
    'affectedPatientsCount',
  ],
  timeline: ['timelineEvents'],
  measures: [
    'immediateCause',
    'contributingFactors',
    'correctiveActions',
    'preventiveMeasures',
  ],
  closing: ['conclusion'],
  signatures: ['accessLogs', 'issuerSignature', 'recipientSignature'],
};

const FIELD_TO_STEP = new Map<string, IncidentFormStep>(
  INCIDENT_FORM_STEPS.flatMap((step) =>
    INCIDENT_STEP_FIELDS[step].map(
      (field) => [field as string, step] as [string, IncidentFormStep]
    )
  )
);

// The step that owns `field`, or undefined for a field outside the wizard.
export function stepForField(field: string): IncidentFormStep | undefined {
  return FIELD_TO_STEP.get(field);
}

// Index of `step` in the wizard order — the value `currentStepIndex` expects.
export function stepIndex(step: IncidentFormStep): number {
  return INCIDENT_FORM_STEPS.indexOf(step);
}

function pickStepData(
  step: IncidentFormStep,
  data: Record<string, unknown>
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of INCIDENT_STEP_FIELDS[step]) {
    picked[field] = data[field];
  }
  return picked;
}

export function validateIncidentStep(
  step: IncidentFormStep,
  data: Record<string, unknown>,
  intl: IntlService
): { ok: true } | { ok: false; issues: z.ZodIssue[] } {
  const baseSchema = createIncidentBaseSchema(intl);
  const fields = INCIDENT_STEP_FIELDS[step];
  const partialShape = Object.fromEntries(
    fields.map((field) => [field, true])
  ) as Record<keyof ValidatedIncident, true>;
  let stepSchema = baseSchema.pick(partialShape);

  if (step === 'impact') {
    stepSchema = stepSchema.superRefine((values, ctx) => {
      refineArt9Impact(values, ctx, intl);
    });
  }

  if (step === 'context') {
    stepSchema = stepSchema.superRefine((values, ctx) => {
      refineIncidentDates(values, ctx, intl);
    });
  }

  const result = stepSchema.safeParse(pickStepData(step, data));
  if (result.success) {
    return { ok: true };
  }
  return { ok: false, issues: result.error.issues };
}
