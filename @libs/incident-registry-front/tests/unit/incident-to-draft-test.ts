import { describe, it, expect as hardExpect } from 'vitest';
import { incidentToDraft } from '#src/changesets/incident.ts';
import type { Incident } from '#src/schemas/incidents.ts';

const expect = hardExpect.soft;

const incident = {
  id: 'inc-1',
  reference: 'INC-2026-0001-IPBW',
  reportDate: '2026-02-20T10:00:00.000Z',
  version: '1.0',
  classification: 'CONFIDENTIEL',
  status: 'resolved',
  applicationName: 'Portail',
  applicationDetail: 'Auth',
  environment: 'production',
  clientCode: 'IPBW',
  clientName: 'IPBW SA',
  reportedBy: 'Support',
  encodedBy: 'user-1',
  encodedAt: '2026-02-20T10:00:00.000Z',
  recipientName: 'DSI',
  recipientOrg: 'IPBW',
  legalContext: 'Cadre RGPD',
  serviceName: 'API',
  deployedVersion: '2.4.1',
  incidentStartAt: '2026-02-19T08:00:00.000Z',
  incidentEndAt: null,
  detectedAt: '2026-02-19T08:15:00.000Z',
  resolvedAt: null,
  resolutionDurationMinutes: 255,
  technicalLeadId: null,
  description: 'Incident test',
  descriptionSections: [{ title: 'Bloc', body: 'Contenu legacy' }],
  personalDataImpacted: true,
  specialCategoryData: false,
  apdNotificationRequired: false,
  impactSummary: 'Impact',
  severityOperational: 'high',
  severityCompliance: 'medium',
  severityOverall: 'high',
  affectedPersonsCount: 50,
  affectedPatientsCount: null,
  immediateCause: 'Régression',
  contributingFactors: ['facteur'],
  correctiveActions: [],
  preventiveMeasures: ['mesure'],
  communicationPlan: null,
  conclusion: 'Résolu',
  timelineEvents: [{ date: '2026-02-19', time: '08:00', event: 'Début' }],
  accessLogs: null,
  issuerSignature: { name: 'RSSI', role: 'RSSI', date: '2026-02-20' },
  recipientSignature: null,
  seq: 1,
  prevHash: '0'.repeat(64),
  hash: 'a'.repeat(64),
  revision: 1,
  supersededById: null,
  updatedBy: null,
  updatedAt: null,
  deletedAt: null,
  deletedBy: null,
} as unknown as Incident;

describe('incidentToDraft', function () {
  it('reconvertit les dates ISO en objets Date pour le datepicker', function () {
    const draft = incidentToDraft(incident);
    expect(draft.reportDate).toBeInstanceOf(Date);
    expect(draft.incidentStartAt).toBeInstanceOf(Date);
    expect(draft.detectedAt).toBeInstanceOf(Date);
    // Les dates nulles restent nulles.
    expect(draft.incidentEndAt).toBeNull();
    expect(draft.resolvedAt).toBeNull();
  });

  it('normalise descriptionSections (body legacy → detail)', function () {
    const draft = incidentToDraft(incident);
    expect(draft.descriptionSections).toEqual([
      { title: 'Bloc', detail: 'Contenu legacy' },
    ]);
  });

  it('normalise les signatures en {name, date}', function () {
    const draft = incidentToDraft(incident);
    expect(draft.issuerSignature).toEqual({ name: 'RSSI', date: '2026-02-20' });
    // Signature absente → objet vide normalisé.
    expect(draft.recipientSignature).toEqual({ name: '', date: '' });
  });

  it('copie les champs de contenu et les listes', function () {
    const draft = incidentToDraft(incident);
    expect(draft.clientCode).toBe('IPBW');
    expect(draft.contributingFactors).toEqual(['facteur']);
    expect(draft.preventiveMeasures).toEqual(['mesure']);
    expect(draft.personalDataImpacted).toBe(true);
  });
});
