import type { IncidentEntityType } from "#src/entities/incident.entity.js";
import { array, boolean, nullable, number, object, string } from "zod";
import { z } from "zod";
import { makeJsonApiDocumentSchema } from "@libs/backend-shared";

const TimelineEventSchema = object({
  date: string(),
  time: string(),
  event: string(),
});

const CorrectiveActionSchema = object({
  phase: string().optional(),
  order: number().int(),
  title: string(),
  detail: string(),
  completedAt: string().optional(),
});

const AccessLogSchema = object({
  date: string(),
  user: string(),
  email: string(),
  files: string(),
  count: number().int(),
});

const DescriptionSectionSchema = object({
  title: string(),
  body: string().optional(),
  items: array(string()).optional(),
}).passthrough();

const ImpactDetailsSchema = object({
  nature: array(string()).optional(),
  severityIntro: string().optional(),
  severityPoints: array(string()).optional(),
}).passthrough();

const SignatureSchema = object({
  name: string(),
  role: string().optional(),
  org: string().optional(),
  date: string().optional(),
}).passthrough();

export const SerializedIncidentSchema = makeJsonApiDocumentSchema(
  "incidents",
  object({
    reference: string(),
    reportDate: string(),
    version: string(),
    classification: string(),
    status: string(),
    applicationName: string(),
    applicationDetail: string(),
    environment: string(),
    clientCode: string(),
    clientName: string(),
    reportedBy: string(),
    encodedBy: string(),
    encodedAt: string(),
    recipientName: string(),
    recipientOrg: string(),
    legalContext: string(),
    serviceName: string(),
    deployedVersion: string(),
    incidentStartAt: string(),
    incidentEndAt: nullable(string()),
    detectedAt: string(),
    resolvedAt: nullable(string()),
    resolutionDurationMinutes: nullable(number().int()),
    technicalLeadId: nullable(string()),
    description: string(),
    descriptionSections: nullable(array(DescriptionSectionSchema)),
    personalDataImpacted: boolean(),
    specialCategoryData: boolean(),
    apdNotificationRequired: nullable(boolean()),
    impactSummary: string(),
    impactDetails: nullable(ImpactDetailsSchema),
    severityOperational: nullable(string()),
    severityCompliance: nullable(string()),
    severityOverall: nullable(string()),
    affectedPersonsCount: nullable(number().int()),
    affectedPatientsCount: nullable(number().int()),
    immediateCause: string(),
    contributingFactors: array(string()),
    correctiveActions: array(CorrectiveActionSchema),
    preventiveMeasures: array(string()),
    communicationPlan: nullable(array(z.unknown())),
    conclusion: string(),
    timelineEvents: array(TimelineEventSchema),
    accessLogs: nullable(array(AccessLogSchema)),
    issuerSignature: SignatureSchema,
    recipientSignature: SignatureSchema,
    seq: z.number().int(),
    prevHash: string(),
    hash: string(),
  }),
);

export type SerializedIncident = z.infer<typeof SerializedIncidentSchema>;

export function jsonApiSerializeIncident(record: IncidentEntityType): SerializedIncident {
  return {
    id: record.id,
    type: "incidents" as const,
    attributes: {
      reference: record.reference,
      reportDate: record.reportDate,
      version: record.version,
      classification: record.classification,
      status: record.status,
      applicationName: record.applicationName,
      applicationDetail: record.applicationDetail,
      environment: record.environment,
      clientCode: record.clientCode,
      clientName: record.clientName,
      reportedBy: record.reportedBy,
      encodedBy: record.encodedBy,
      encodedAt: record.encodedAt,
      recipientName: record.recipientName,
      recipientOrg: record.recipientOrg,
      legalContext: record.legalContext,
      serviceName: record.serviceName,
      deployedVersion: record.deployedVersion,
      incidentStartAt: record.incidentStartAt,
      incidentEndAt: record.incidentEndAt ?? null,
      detectedAt: record.detectedAt,
      resolvedAt: record.resolvedAt ?? null,
      resolutionDurationMinutes: record.resolutionDurationMinutes ?? null,
      technicalLeadId: record.technicalLeadId ?? null,
      description: record.description,
      descriptionSections:
        (record.descriptionSections as SerializedIncident["attributes"]["descriptionSections"]) ??
        null,
      personalDataImpacted: record.personalDataImpacted,
      specialCategoryData: record.specialCategoryData,
      apdNotificationRequired: record.apdNotificationRequired ?? null,
      impactSummary: record.impactSummary,
      impactDetails:
        (record.impactDetails as SerializedIncident["attributes"]["impactDetails"]) ?? null,
      severityOperational: record.severityOperational ?? null,
      severityCompliance: record.severityCompliance ?? null,
      severityOverall: record.severityOverall ?? null,
      affectedPersonsCount: record.affectedPersonsCount ?? null,
      affectedPatientsCount: record.affectedPatientsCount ?? null,
      immediateCause: record.immediateCause,
      contributingFactors: record.contributingFactors as string[],
      correctiveActions:
        record.correctiveActions as SerializedIncident["attributes"]["correctiveActions"],
      preventiveMeasures: record.preventiveMeasures as string[],
      communicationPlan: (record.communicationPlan as Record<string, unknown>[] | null) ?? null,
      conclusion: record.conclusion,
      timelineEvents: record.timelineEvents as SerializedIncident["attributes"]["timelineEvents"],
      accessLogs: (record.accessLogs as SerializedIncident["attributes"]["accessLogs"]) ?? null,
      issuerSignature:
        record.issuerSignature as SerializedIncident["attributes"]["issuerSignature"],
      recipientSignature:
        record.recipientSignature as SerializedIncident["attributes"]["recipientSignature"],
      seq: record.seq,
      prevHash: record.prevHash,
      hash: record.hash,
    },
  };
}

export function jsonApiSerializeManyIncidents(records: IncidentEntityType[]) {
  return records.map(jsonApiSerializeIncident);
}

export function jsonApiSerializeSingleIncidentDocument(record: IncidentEntityType) {
  return { data: jsonApiSerializeIncident(record) };
}

export function jsonApiSerializeManyIncidentsDocument(records: IncidentEntityType[]) {
  return { data: jsonApiSerializeManyIncidents(records) };
}
