import ImmerChangeset from 'ember-immer-changeset';
import type { ValidatedIncident } from '#src/components/forms/incident-validation.ts';
import type { Incident } from '#src/schemas/incidents.ts';

// @lat: [[frontend/forms#Valeur initiale null obligatoire pour TpkDatepickerPrefab]]
// reportDate/incidentStartAt/detectedAt are required strings in ValidatedIncident
// (no null in their zod type), but TpkValidationDatepicker's `value` getter
// asserts on string | Date | null — never undefined. The draft must be able to
// hold `null` while the field is still empty, so we widen just these three.
//
// @lat: [[frontend/forms#Stocker un Date, pas une string, pendant l'édition]]
// All 5 fields are declared as string (or string|null) here to satisfy
// TpkForm's changeset<->schema type coupling, but setDateField in
// incident-form.gts actually stores a runtime Date, cast through this type —
// incident-validation.ts converts it back to ISO at validation.
export type DraftIncident = Omit<
  Partial<ValidatedIncident>,
  'reportDate' | 'incidentStartAt' | 'detectedAt'
> & {
  reportDate?: string | null;
  incidentStartAt?: string | null;
  detectedAt?: string | null;
};

export class IncidentChangeset extends ImmerChangeset<DraftIncident> {}

// @lat: [[frontend/forms#Stocker un Date, pas une string, pendant l'édition]]
// ISO string → Date runtime : le datepicker attend un Date ; on le stocke
// casté à travers le type string|null du draft (même hack que setDateField).
function isoToDate(value: string | null | undefined): string | null {
  return (value ? new Date(value) : null) as unknown as string | null;
}

type SeverityDraft = DraftIncident['severityOverall'];

// Mappe un incident chargé (attributs sérialisés) vers un DraftIncident
// pré-rempli pour le wizard en mode édition. Reconvertit les dates ISO→Date et
// normalise les formes des éditeurs imbriqués (descriptionSections, signatures).
export function incidentToDraft(incident: Incident): DraftIncident {
  const signature = (
    sig: { name?: string; date?: string } | null | undefined
  ) => ({ name: sig?.name ?? '', date: sig?.date ?? '' });

  const sections = (incident.descriptionSections ?? []) as unknown as {
    title: string;
    detail?: string;
    body?: string;
  }[];

  return {
    version: incident.version,
    classification: incident.classification as DraftIncident['classification'],
    status: incident.status as DraftIncident['status'],
    environment: incident.environment as DraftIncident['environment'],
    applicationName: incident.applicationName,
    applicationDetail: incident.applicationDetail ?? '',
    clientCode: incident.clientCode,
    clientName: incident.clientName,
    reportedBy: incident.reportedBy,
    recipientName: incident.recipientName ?? '',
    recipientOrg: incident.recipientOrg ?? '',
    legalContext: incident.legalContext ?? '',
    serviceName: incident.serviceName ?? '',
    deployedVersion: incident.deployedVersion ?? '',
    resolutionDurationMinutes: incident.resolutionDurationMinutes,
    technicalLeadId: incident.technicalLeadId,
    description: incident.description ?? '',
    personalDataImpacted: incident.personalDataImpacted,
    specialCategoryData: incident.specialCategoryData,
    apdNotificationRequired: incident.apdNotificationRequired,
    impactSummary: incident.impactSummary ?? '',
    severityOperational: incident.severityOperational as SeverityDraft,
    severityCompliance: incident.severityCompliance as SeverityDraft,
    severityOverall: incident.severityOverall as SeverityDraft,
    affectedPersonsCount: incident.affectedPersonsCount,
    affectedPatientsCount: incident.affectedPatientsCount,
    immediateCause: incident.immediateCause ?? '',
    contributingFactors: (incident.contributingFactors as string[]) ?? [],
    correctiveActions:
      (incident.correctiveActions as DraftIncident['correctiveActions']) ?? [],
    preventiveMeasures: (incident.preventiveMeasures as string[]) ?? [],
    communicationPlan:
      (incident.communicationPlan as DraftIncident['communicationPlan']) ??
      undefined,
    conclusion: incident.conclusion ?? '',
    timelineEvents:
      (incident.timelineEvents as DraftIncident['timelineEvents']) ?? [],
    accessLogs: (incident.accessLogs as DraftIncident['accessLogs']) ?? [],
    descriptionSections: sections.map((s) => ({
      title: s.title,
      detail: s.detail ?? s.body ?? '',
    })),
    issuerSignature: signature(incident.issuerSignature),
    recipientSignature: signature(incident.recipientSignature),
    reportDate: isoToDate(incident.reportDate),
    incidentStartAt: isoToDate(incident.incidentStartAt),
    incidentEndAt: isoToDate(incident.incidentEndAt),
    detectedAt: isoToDate(incident.detectedAt),
    resolvedAt: isoToDate(incident.resolvedAt),
  };
}
