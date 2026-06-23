import { describe, expect, test } from 'vitest';
import type { IntlService } from 'ember-intl';
import { createIncidentValidationSchema } from '#src/components/forms/incident-validation.ts';

const fakeIntl = { t: (key: string) => key } as unknown as IntlService;

const BASE_VALID = {
  reportDate: '2026-02-20T10:00:00.000Z',
  version: '1.0',
  classification: 'CONFIDENTIEL' as const,
  status: 'resolved' as const,
  applicationName: 'Portail Admin',
  applicationDetail: 'Module auth',
  environment: 'production' as const,
  clientCode: 'IPBW',
  clientName: 'IPBW SA',
  reportedBy: 'Support',
  recipientName: 'DSI',
  recipientOrg: 'IPBW',
  legalContext: 'Cadre RGPD',
  serviceName: 'API Auth',
  deployedVersion: '2.4.1',
  incidentStartAt: '2026-02-19T08:00:00.000Z',
  detectedAt: '2026-02-19T08:15:00.000Z',
  description: 'Incident test',
  personalDataImpacted: true,
  specialCategoryData: false,
  impactSummary: '50 utilisateurs impactés',
  immediateCause: 'Régression',
  contributingFactors: [],
  correctiveActions: [],
  preventiveMeasures: [],
  conclusion: 'Résolu',
  timelineEvents: [{ date: '2026-02-19', time: '08:00', event: 'Début' }],
};

describe('createIncidentValidationSchema', () => {
  const schema = createIncidentValidationSchema(fakeIntl);

  test('valide un incident complet', () => {
    expect(schema.safeParse(BASE_VALID).success).toBe(true);
  });

  test('rejette si clientCode est vide', () => {
    expect(schema.safeParse({ ...BASE_VALID, clientCode: '' }).success).toBe(
      false
    );
  });

  test('rejette si impactSummary est vide', () => {
    expect(schema.safeParse({ ...BASE_VALID, impactSummary: '' }).success).toBe(
      false
    );
  });
});
