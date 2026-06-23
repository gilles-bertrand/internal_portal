import {
  withDefaults,
  type WithLegacy,
} from '@warp-drive/legacy/model/migration-support';
import type { Type } from '@warp-drive/core/types/symbols';

export type DescriptionSection = {
  title: string;
  body?: string;
  items?: string[];
};
export type ImpactDetails = {
  nature?: string[];
  severityIntro?: string;
  severityPoints?: string[];
};
export type IncidentSignature = {
  name: string;
  role?: string;
  org?: string;
  date?: string;
};

const IncidentSchema = withDefaults({
  type: 'incidents',
  fields: [
    { name: 'reference', kind: 'attribute' },
    { name: 'reportDate', kind: 'attribute' },
    { name: 'version', kind: 'attribute' },
    { name: 'classification', kind: 'attribute' },
    { name: 'status', kind: 'attribute' },
    { name: 'applicationName', kind: 'attribute' },
    { name: 'applicationDetail', kind: 'attribute' },
    { name: 'environment', kind: 'attribute' },
    { name: 'clientCode', kind: 'attribute' },
    { name: 'clientName', kind: 'attribute' },
    { name: 'reportedBy', kind: 'attribute' },
    { name: 'encodedBy', kind: 'attribute' },
    { name: 'encodedByName', kind: 'attribute' },
    { name: 'encodedAt', kind: 'attribute' },
    { name: 'recipientName', kind: 'attribute' },
    { name: 'recipientOrg', kind: 'attribute' },
    { name: 'legalContext', kind: 'attribute' },
    { name: 'serviceName', kind: 'attribute' },
    { name: 'deployedVersion', kind: 'attribute' },
    { name: 'incidentStartAt', kind: 'attribute' },
    { name: 'incidentEndAt', kind: 'attribute' },
    { name: 'detectedAt', kind: 'attribute' },
    { name: 'resolvedAt', kind: 'attribute' },
    { name: 'resolutionDurationMinutes', kind: 'attribute' },
    { name: 'technicalLeadId', kind: 'attribute' },
    { name: 'description', kind: 'attribute' },
    { name: 'descriptionSections', kind: 'attribute' },
    { name: 'personalDataImpacted', kind: 'attribute' },
    { name: 'specialCategoryData', kind: 'attribute' },
    { name: 'apdNotificationRequired', kind: 'attribute' },
    { name: 'impactSummary', kind: 'attribute' },
    { name: 'impactDetails', kind: 'attribute' },
    { name: 'severityOperational', kind: 'attribute' },
    { name: 'severityCompliance', kind: 'attribute' },
    { name: 'severityOverall', kind: 'attribute' },
    { name: 'affectedPersonsCount', kind: 'attribute' },
    { name: 'affectedPatientsCount', kind: 'attribute' },
    { name: 'immediateCause', kind: 'attribute' },
    { name: 'contributingFactors', kind: 'attribute' },
    { name: 'correctiveActions', kind: 'attribute' },
    { name: 'preventiveMeasures', kind: 'attribute' },
    { name: 'communicationPlan', kind: 'attribute' },
    { name: 'conclusion', kind: 'attribute' },
    { name: 'timelineEvents', kind: 'attribute' },
    { name: 'accessLogs', kind: 'attribute' },
    { name: 'issuerSignature', kind: 'attribute' },
    { name: 'recipientSignature', kind: 'attribute' },
    { name: 'seq', kind: 'attribute' },
    { name: 'prevHash', kind: 'attribute' },
    { name: 'hash', kind: 'attribute' },
  ],
});

export default IncidentSchema;

export type Incident = WithLegacy<{
  reference: string;
  reportDate: string;
  version: string;
  classification: string;
  status: string;
  applicationName: string;
  applicationDetail: string | null;
  environment: string;
  clientCode: string;
  clientName: string;
  reportedBy: string;
  encodedBy: string;
  encodedByName?: string;
  encodedAt: string;
  recipientName: string | null;
  recipientOrg: string | null;
  legalContext: string | null;
  serviceName: string | null;
  deployedVersion: string | null;
  incidentStartAt: string | null;
  incidentEndAt: string | null;
  detectedAt: string | null;
  resolvedAt: string | null;
  resolutionDurationMinutes: number | null;
  technicalLeadId: string | null;
  description: string | null;
  descriptionSections: DescriptionSection[] | null;
  personalDataImpacted: boolean;
  specialCategoryData: boolean;
  apdNotificationRequired: boolean | null;
  impactSummary: string | null;
  impactDetails: ImpactDetails | null;
  severityOperational: string | null;
  severityCompliance: string | null;
  severityOverall: string | null;
  affectedPersonsCount: number | null;
  affectedPatientsCount: number | null;
  immediateCause: string | null;
  contributingFactors: unknown;
  correctiveActions: unknown;
  preventiveMeasures: unknown;
  communicationPlan: unknown;
  conclusion: string | null;
  timelineEvents: unknown;
  accessLogs: unknown;
  issuerSignature: IncidentSignature;
  recipientSignature: IncidentSignature;
  seq: number;
  prevHash: string;
  hash: string;
  [Type]: 'incidents';
}>;
