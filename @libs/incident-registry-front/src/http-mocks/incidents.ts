import { http, HttpResponse } from 'msw';

const sampleIncident = {
  id: 'inc-1',
  type: 'incidents',
  attributes: {
    reference: 'INC-2026-0001-IPBW',
    reportDate: '2026-02-20T10:00:00.000Z',
    version: '1.0',
    classification: 'CONFIDENTIEL',
    status: 'resolved',
    applicationName: 'Portail Admin',
    applicationDetail: 'Module auth',
    environment: 'production',
    clientCode: 'IPBW',
    clientName: 'IPBW SA',
    reportedBy: 'Support',
    encodedBy: 'user-1',
    encodedByName: 'Test User',
    encodedAt: '2026-02-20T10:00:00.000Z',
    recipientName: 'DSI',
    recipientOrg: 'IPBW',
    legalContext: 'Cadre RGPD',
    serviceName: 'API Auth',
    deployedVersion: '2.4.1',
    incidentStartAt: '2026-02-19T08:00:00.000Z',
    incidentEndAt: null,
    detectedAt: '2026-02-19T08:15:00.000Z',
    resolvedAt: '2026-02-19T12:30:00.000Z',
    resolutionDurationMinutes: 255,
    technicalLeadId: null,
    description: 'Incident test',
    descriptionSections: null,
    personalDataImpacted: true,
    specialCategoryData: false,
    apdNotificationRequired: false,
    impactSummary: '50 users',
    impactDetails: null,
    severityOperational: 'high',
    severityCompliance: 'medium',
    severityOverall: 'high',
    affectedPersonsCount: 50,
    affectedPatientsCount: null,
    immediateCause: 'Regression',
    contributingFactors: null,
    correctiveActions: null,
    preventiveMeasures: null,
    communicationPlan: null,
    conclusion: 'Résolu',
    timelineEvents: [{ date: '2026-02-19', time: '08:00', event: 'Début' }],
    accessLogs: null,
    issuerSignature: null,
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
  },
};

const deletedIncident = {
  ...sampleIncident,
  id: 'inc-2',
  attributes: {
    ...sampleIncident.attributes,
    reference: 'INC-2026-0002-IPBW',
    seq: 2,
    deletedAt: '2026-03-01T09:00:00.000Z',
    deletedBy: 'dpo-1',
  },
};

export default [
  http.get('/api/v1/incidents', ({ request }) => {
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('filter[includeDeleted]');
    const data =
      includeDeleted === 'true'
        ? [sampleIncident, deletedIncident]
        : [sampleIncident];
    return HttpResponse.json({ data, meta: { total: data.length } });
  }),
  http.get('/api/v1/incidents/:id', ({ params }) =>
    HttpResponse.json({ data: { ...sampleIncident, id: params.id } })
  ),
  http.post('/api/v1/incidents', () =>
    HttpResponse.json({ data: sampleIncident })
  ),
  // Édition = nouvelle version (revision 2) côté backend.
  http.put('/api/v1/incidents/:id', ({ params }) =>
    HttpResponse.json({
      data: {
        ...sampleIncident,
        id: `${String(params.id)}-v2`,
        attributes: { ...sampleIncident.attributes, revision: 2 },
      },
    })
  ),
  http.delete('/api/v1/incidents/:id', ({ params }) =>
    HttpResponse.json({ data: { id: params.id, type: 'incidents' } })
  ),
  http.post('/api/v1/incidents/:id/restore', ({ params }) =>
    HttpResponse.json({
      data: {
        ...sampleIncident,
        id: params.id,
        attributes: { ...sampleIncident.attributes, deletedAt: null },
      },
    })
  ),
  http.post('/api/v1/incidents/export', () =>
    HttpResponse.json({
      data: {
        format: 'pdf',
        encoding: 'base64',
        content: btoa('%PDF-1.4 mock'),
        manifest: {
          generatedAt: new Date().toISOString(),
          generatedBy: 'user-1',
          count: 1,
          chainHeadHash: 'a'.repeat(64),
          contentSha256: 'b'.repeat(64),
          integrityOk: true,
        },
        signature: 'c'.repeat(64),
      },
    })
  ),
  http.post('/api/v1/incidents/:id/export', () =>
    HttpResponse.json({
      data: {
        format: 'pdf',
        encoding: 'base64',
        content: btoa('%PDF-1.4 mock report'),
        manifest: {
          generatedAt: new Date().toISOString(),
          generatedBy: 'user-1',
          count: 1,
          chainHeadHash: 'a'.repeat(64),
          contentSha256: 'b'.repeat(64),
          integrityOk: true,
        },
        signature: 'c'.repeat(64),
      },
    })
  ),
];
