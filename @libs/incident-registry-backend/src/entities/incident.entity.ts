import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const IncidentEntity = defineEntity({
  name: "Incident",
  tableName: "incident",
  properties: {
    id: p.string().primary(),
    seq: p.integer().unique(),
    reference: p.string().unique(),
    reportDate: p.string(),
    version: p.string(),
    classification: p.string(),
    status: p.string(),
    applicationName: p.string(),
    applicationDetail: p.string(),
    environment: p.string(),
    clientCode: p.string(),
    clientName: p.string(),
    reportedBy: p.string(),
    encodedBy: p.string(),
    encodedAt: p.string(),
    recipientName: p.string(),
    recipientOrg: p.string(),
    legalContext: p.string(),
    serviceName: p.string(),
    deployedVersion: p.string(),
    incidentStartAt: p.string(),
    incidentEndAt: p.string().nullable(),
    detectedAt: p.string(),
    resolvedAt: p.string().nullable(),
    resolutionDurationMinutes: p.integer().nullable(),
    technicalLeadId: p.string().nullable(),
    description: p.string(),
    descriptionSections: p.json<{ title: string; body?: string; items?: string[] }[]>().nullable(),
    personalDataImpacted: p.boolean().default(false),
    specialCategoryData: p.boolean().default(false),
    apdNotificationRequired: p.boolean().nullable(),
    impactSummary: p.string(),
    impactDetails: p
      .json<{
        nature?: string[];
        severityIntro?: string;
        severityPoints?: string[];
      }>()
      .nullable(),
    severityOperational: p.string().nullable(),
    severityCompliance: p.string().nullable(),
    severityOverall: p.string().nullable(),
    affectedPersonsCount: p.integer().nullable(),
    affectedPatientsCount: p.integer().nullable(),
    immediateCause: p.string(),
    contributingFactors: p.json<string[]>(),
    correctiveActions:
      p.json<
        { phase?: string; order: number; title: string; detail: string; completedAt?: string }[]
      >(),
    preventiveMeasures: p.json<string[]>(),
    communicationPlan: p.json<Record<string, unknown>[]>().nullable(),
    conclusion: p.string(),
    timelineEvents: p.json<{ date: string; time: string; event: string }[]>(),
    accessLogs: p
      .json<{ date: string; user: string; email: string; files: string; count: number }[]>()
      .nullable(),
    issuerSignature: p.json<{ name: string; role?: string; org?: string; date?: string }>(),
    recipientSignature: p.json<{ name: string; role?: string; org?: string; date?: string }>(),
    prevHash: p.string(),
    hash: p.string().unique(),
  },
});

export type IncidentEntityType = InferEntity<typeof IncidentEntity>;
