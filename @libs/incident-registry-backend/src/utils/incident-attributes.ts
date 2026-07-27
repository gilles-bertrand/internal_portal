import { array, boolean, nullable, number, object, string } from "zod";
import { z } from "zod";
import type { NewIncidentInput } from "#src/utils/append.service.js";

const CLASSIFICATIONS = ["CONFIDENTIEL", "INTERNE", "PUBLIC"] as const;
const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const ENVIRONMENTS = ["production", "staging", "development"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const TimelineEventSchema = object({
  date: string().min(1),
  time: string().min(1),
  event: string().min(1),
});

const CorrectiveActionSchema = object({
  phase: string().optional(),
  order: number().int(),
  title: string().min(1),
  detail: string().min(1),
  completedAt: string().datetime().optional(),
});

const AccessLogSchema = object({
  date: string().min(1),
  user: string().min(1),
  email: string().min(1),
  files: string(),
  count: number().int(),
});

// Schéma des attributs d'un incident, partagé par la création (POST) et
// l'édition (PUT = nouvelle version). Contenu identique dans les deux cas.
export const IncidentAttributesSchema = object({
  reportDate: string().datetime(),
  version: string().min(1),
  classification: string().refine(
    (v) => CLASSIFICATIONS.includes(v as (typeof CLASSIFICATIONS)[number]),
    { message: "classification invalide" },
  ),
  status: string().refine((v) => STATUSES.includes(v as (typeof STATUSES)[number]), {
    message: "status invalide",
  }),
  applicationName: string().min(1),
  applicationDetail: string().min(1),
  environment: string().refine((v) => ENVIRONMENTS.includes(v as (typeof ENVIRONMENTS)[number]), {
    message: "environment invalide",
  }),
  clientCode: string().min(1),
  clientName: string().min(1),
  reportedBy: string().min(1),
  recipientName: string().min(1),
  recipientOrg: string().min(1),
  legalContext: string().min(1),
  serviceName: string().min(1),
  deployedVersion: string().min(1),
  incidentStartAt: string().datetime(),
  incidentEndAt: nullable(string().datetime()).optional(),
  detectedAt: string().datetime(),
  resolvedAt: nullable(string().datetime()).optional(),
  resolutionDurationMinutes: nullable(number().int()).optional(),
  technicalLeadId: nullable(string()).optional(),
  description: string().min(1),
  descriptionSections: nullable(
    array(
      object({
        title: string().min(1),
        body: string().optional(),
        items: array(string()).optional(),
      }).passthrough(),
    ),
  ).optional(),
  personalDataImpacted: boolean(),
  specialCategoryData: boolean(),
  apdNotificationRequired: nullable(boolean()).optional(),
  impactSummary: string().min(1),
  impactDetails: nullable(
    object({
      nature: array(string()).optional(),
      severityIntro: string().optional(),
      severityPoints: array(string()).optional(),
    }).passthrough(),
  ).optional(),
  severityOperational: nullable(
    string().refine((v) => SEVERITIES.includes(v as (typeof SEVERITIES)[number]), {
      message: "severityOperational invalide",
    }),
  ).optional(),
  severityCompliance: nullable(
    string().refine((v) => SEVERITIES.includes(v as (typeof SEVERITIES)[number]), {
      message: "severityCompliance invalide",
    }),
  ).optional(),
  severityOverall: nullable(
    string().refine((v) => SEVERITIES.includes(v as (typeof SEVERITIES)[number]), {
      message: "severityOverall invalide",
    }),
  ).optional(),
  affectedPersonsCount: nullable(number().int()).optional(),
  affectedPatientsCount: nullable(number().int()).optional(),
  immediateCause: string().min(1),
  contributingFactors: array(string()),
  correctiveActions: array(CorrectiveActionSchema),
  preventiveMeasures: array(string()),
  communicationPlan: nullable(array(object({}).passthrough())).optional(),
  conclusion: string().min(1),
  timelineEvents: array(TimelineEventSchema).min(1),
  accessLogs: nullable(array(AccessLogSchema)).optional(),
  issuerSignature: object({
    name: string().min(1),
    role: string().optional(),
    org: string().optional(),
    date: string().optional(),
  }).passthrough(),
  recipientSignature: object({
    name: string().min(1),
    role: string().optional(),
    org: string().optional(),
    date: string().optional(),
  }).passthrough(),
});

export type IncidentAttributes = z.infer<typeof IncidentAttributesSchema>;

export interface IncidentBusinessRuleError {
  code: string;
  detail: string;
  pointer: string;
}

function parseIso(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

// @lat: [[backend/incident-registry#Validation métier à la création]]
// Règles métier communes création/édition : cohérence des dates + champs
// obligatoires pour les données art. 9.
export function validateIncidentBusinessRules(
  attrs: IncidentAttributes,
): IncidentBusinessRuleError | null {
  const start = parseIso(attrs.incidentStartAt);
  const end = parseIso(attrs.incidentEndAt);
  if (end !== null && start !== null && end < start) {
    return {
      code: "INCOHERENT_DATES",
      detail: "incidentEndAt doit être postérieur ou égal à incidentStartAt",
      pointer: "/data/attributes/incidentEndAt",
    };
  }

  const detected = parseIso(attrs.detectedAt);
  const resolved = parseIso(attrs.resolvedAt);
  if (resolved !== null && detected !== null && resolved < detected) {
    return {
      code: "INCOHERENT_DATES",
      detail: "resolvedAt doit être postérieur ou égal à detectedAt",
      pointer: "/data/attributes/resolvedAt",
    };
  }

  if (attrs.specialCategoryData) {
    if (!attrs.severityOverall || !attrs.severityCompliance) {
      return {
        code: "MISSING_IMPACT_FIELDS",
        detail: "severityOverall et severityCompliance sont requis pour les données art. 9",
        pointer: "/data/attributes/severityOverall",
      };
    }
    if (attrs.affectedPersonsCount == null && attrs.affectedPatientsCount == null) {
      return {
        code: "MISSING_IMPACT_FIELDS",
        detail: "affectedPersonsCount ou affectedPatientsCount est requis pour les données art. 9",
        pointer: "/data/attributes/affectedPersonsCount",
      };
    }
  }

  return null;
}

// Construit l'input de l'AppendService depuis les attributs validés.
export function toNewIncidentInput(attrs: IncidentAttributes, encodedBy: string): NewIncidentInput {
  return {
    reportDate: attrs.reportDate,
    version: attrs.version,
    classification: attrs.classification,
    status: attrs.status,
    applicationName: attrs.applicationName,
    applicationDetail: attrs.applicationDetail,
    environment: attrs.environment,
    clientCode: attrs.clientCode,
    clientName: attrs.clientName,
    reportedBy: attrs.reportedBy,
    encodedBy,
    recipientName: attrs.recipientName,
    recipientOrg: attrs.recipientOrg,
    legalContext: attrs.legalContext,
    serviceName: attrs.serviceName,
    deployedVersion: attrs.deployedVersion,
    incidentStartAt: attrs.incidentStartAt,
    incidentEndAt: attrs.incidentEndAt ?? null,
    detectedAt: attrs.detectedAt,
    resolvedAt: attrs.resolvedAt ?? null,
    resolutionDurationMinutes: attrs.resolutionDurationMinutes ?? null,
    technicalLeadId: attrs.technicalLeadId ?? null,
    description: attrs.description,
    descriptionSections: attrs.descriptionSections ?? null,
    personalDataImpacted: attrs.personalDataImpacted,
    specialCategoryData: attrs.specialCategoryData,
    apdNotificationRequired: attrs.apdNotificationRequired ?? null,
    impactSummary: attrs.impactSummary,
    impactDetails: attrs.impactDetails ?? null,
    severityOperational: attrs.severityOperational ?? null,
    severityCompliance: attrs.severityCompliance ?? null,
    severityOverall: attrs.severityOverall ?? null,
    affectedPersonsCount: attrs.affectedPersonsCount ?? null,
    affectedPatientsCount: attrs.affectedPatientsCount ?? null,
    immediateCause: attrs.immediateCause,
    contributingFactors: attrs.contributingFactors,
    correctiveActions: attrs.correctiveActions,
    preventiveMeasures: attrs.preventiveMeasures,
    communicationPlan: (attrs.communicationPlan as Record<string, unknown>[] | null) ?? null,
    conclusion: attrs.conclusion,
    timelineEvents: attrs.timelineEvents,
    accessLogs: attrs.accessLogs ?? null,
    issuerSignature: attrs.issuerSignature,
    recipientSignature: attrs.recipientSignature,
  };
}
