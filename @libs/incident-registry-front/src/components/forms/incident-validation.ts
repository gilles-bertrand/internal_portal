import { z } from 'zod';
import type IntlService from 'ember-intl/services/intl';

const CLASSIFICATIONS = ['CONFIDENTIEL', 'INTERNE', 'PUBLIC'] as const;
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const ENVIRONMENTS = ['production', 'staging', 'development'] as const;
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

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

const DescriptionSectionSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
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

const optionalInt = z
  .union([z.coerce.number().int(), z.literal(''), z.null()])
  .optional()
  .transform((value) =>
    value === '' || value === null || value === undefined ? null : value
  );

const optionalString = z
  .union([z.string(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

function createIncidentBaseSchema(intl: IntlService) {
  void intl;
  return z.object({
    reportDate: z.string().datetime(),
    version: z.string().min(1),
    classification: z.enum(CLASSIFICATIONS),
    status: z.enum(STATUSES),
    applicationName: z.string().min(1),
    applicationDetail: z.string().min(1),
    environment: z.enum(ENVIRONMENTS),
    clientCode: z.string().min(1),
    clientName: z.string().min(1),
    reportedBy: z.string().min(1),
    recipientName: z.string().min(1),
    recipientOrg: z.string().min(1),
    legalContext: z.string().min(1),
    serviceName: z.string().min(1),
    deployedVersion: z.string().min(1),
    incidentStartAt: z.string().datetime(),
    incidentEndAt: optionalDatetime,
    detectedAt: z.string().datetime(),
    resolvedAt: optionalDatetime,
    resolutionDurationMinutes: optionalInt,
    technicalLeadId: optionalString,
    description: z.string().min(1),
    descriptionSections: z.array(DescriptionSectionSchema).optional(),
    personalDataImpacted: z.boolean(),
    specialCategoryData: z.boolean(),
    apdNotificationRequired: z.boolean().optional().nullable(),
    impactSummary: z.string().min(1),
    severityOperational: optionalSeverity,
    severityCompliance: optionalSeverity,
    severityOverall: optionalSeverity,
    affectedPersonsCount: optionalInt,
    affectedPatientsCount: optionalInt,
    immediateCause: z.string().min(1),
    contributingFactors: z.array(z.string().min(1)),
    correctiveActions: z.array(CorrectiveActionSchema),
    preventiveMeasures: z.array(z.string().min(1)),
    communicationPlan: z.array(CommunicationEntrySchema).optional(),
    conclusion: z.string().min(1),
    timelineEvents: z.array(TimelineEventSchema).min(1),
    accessLogs: z.array(AccessLogSchema).optional().nullable(),
    issuerSignature: SignatureSchema.optional().nullable(),
    recipientSignature: SignatureSchema.optional().nullable(),
  });
}

export function createIncidentValidationSchema(intl: IntlService) {
  return createIncidentBaseSchema(intl).superRefine((data, ctx) => {
    if (data.specialCategoryData) {
      const hasImpact =
        data.impactSummary.trim().length > 0 ||
        (data.affectedPersonsCount ?? 0) > 0 ||
        (data.affectedPatientsCount ?? 0) > 0;
      if (!hasImpact) {
        ctx.addIssue({
          code: 'custom',
          message: 'impact requis pour art. 9',
          path: ['impactSummary'],
        });
      }
    }
    if (
      data.detectedAt &&
      data.resolvedAt &&
      data.resolvedAt < data.detectedAt
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'resolvedAt doit être postérieur à detectedAt',
        path: ['resolvedAt'],
      });
    }
  });
}

export type ValidatedIncident = z.infer<
  ReturnType<typeof createIncidentValidationSchema>
>;

const STEP_FIELDS: Record<IncidentFormStep, (keyof ValidatedIncident)[]> = {
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

function pickStepData(
  step: IncidentFormStep,
  data: Record<string, unknown>
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of STEP_FIELDS[step]) {
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
  const fields = STEP_FIELDS[step];
  const partialShape = Object.fromEntries(
    fields.map((field) => [field, true])
  ) as Record<keyof ValidatedIncident, true>;
  let stepSchema = baseSchema.pick(partialShape);

  if (step === 'impact') {
    stepSchema = stepSchema.superRefine((values, ctx) => {
      if (values.specialCategoryData) {
        const hasImpact =
          values.impactSummary.trim().length > 0 ||
          (values.affectedPersonsCount ?? 0) > 0 ||
          (values.affectedPatientsCount ?? 0) > 0;
        if (!hasImpact) {
          ctx.addIssue({
            code: 'custom',
            message: 'impact requis pour art. 9',
            path: ['impactSummary'],
          });
        }
      }
    });
  }

  if (step === 'context') {
    stepSchema = stepSchema.superRefine((values, ctx) => {
      if (
        values.detectedAt &&
        values.resolvedAt &&
        values.resolvedAt < values.detectedAt
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'resolvedAt doit être postérieur à detectedAt',
          path: ['resolvedAt'],
        });
      }
    });
  }

  const result = stepSchema.safeParse(pickStepData(step, data));
  if (result.success) {
    return { ok: true };
  }
  return { ok: false, issues: result.error.issues };
}
