import { canonicalSerialize, verifyChain } from "@libs/backend-shared";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";

export interface IntegrityCheckResult {
  ok: boolean;
  total: number;
  brokenAt?: number;
  reason?: string;
}

function incidentCanonicalFields(record: IncidentEntityType): Record<string, unknown> {
  return {
    id: record.id,
    seq: record.seq,
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
    incidentEndAt: record.incidentEndAt,
    detectedAt: record.detectedAt,
    resolvedAt: record.resolvedAt,
    resolutionDurationMinutes: record.resolutionDurationMinutes,
    technicalLeadId: record.technicalLeadId,
    description: record.description,
    descriptionSections: record.descriptionSections,
    personalDataImpacted: record.personalDataImpacted,
    specialCategoryData: record.specialCategoryData,
    apdNotificationRequired: record.apdNotificationRequired,
    impactSummary: record.impactSummary,
    impactDetails: record.impactDetails,
    severityOperational: record.severityOperational,
    severityCompliance: record.severityCompliance,
    severityOverall: record.severityOverall,
    affectedPersonsCount: record.affectedPersonsCount,
    affectedPatientsCount: record.affectedPatientsCount,
    immediateCause: record.immediateCause,
    contributingFactors: record.contributingFactors,
    correctiveActions: record.correctiveActions,
    preventiveMeasures: record.preventiveMeasures,
    communicationPlan: record.communicationPlan,
    conclusion: record.conclusion,
    timelineEvents: record.timelineEvents,
    accessLogs: record.accessLogs,
    issuerSignature: record.issuerSignature,
    recipientSignature: record.recipientSignature,
  };
}

export function verifyIncidentChain(records: IncidentEntityType[]): IntegrityCheckResult {
  const links = records.map((record) => ({
    hash: record.hash,
    prevHash: record.prevHash,
    canonical: canonicalSerialize(incidentCanonicalFields(record)),
  }));

  const broken = verifyChain(links);
  if (broken) {
    return { ok: false, total: records.length, ...broken };
  }
  return { ok: true, total: records.length };
}
