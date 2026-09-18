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

  // @lat: [[frontend/incident-registry-contract-gaps#Validation art. 9 alignée sur le backend]]
  //
  // Le backend (`validateIncidentBusinessRules`) exige, quand
  // `specialCategoryData` est vrai : `severityOverall` ET
  // `severityCompliance`, PLUS au moins un compteur de personnes concernées.
  // Le front ne contrôlait rien de tout cela : le wizard laissait passer les
  // huit étapes, l'API répondait 400 `MISSING_IMPACT_FIELDS` sur un champ de
  // l'étape 4 et, ce champ n'étant pas rendu depuis l'étape 8, l'utilisateur
  // ne voyait RIEN et l'incident n'était pas créé.
  describe('règles art. 9 (alignées sur le backend)', () => {
    const ART9 = {
      ...BASE_VALID,
      specialCategoryData: true,
      severityOverall: 'high' as const,
      severityCompliance: 'high' as const,
      affectedPersonsCount: 1240,
    };

    function issuePaths(input: unknown): string[] {
      const result = schema.safeParse(input);
      return result.success
        ? []
        : result.error.issues.map((i) => i.path.join('.'));
    }

    test('accepte un incident art. 9 complet', () => {
      expect(schema.safeParse(ART9).success).toBe(true);
    });

    test('exige severityOverall', () => {
      expect(issuePaths({ ...ART9, severityOverall: null })).toContain(
        'severityOverall'
      );
    });

    test('exige severityCompliance', () => {
      expect(issuePaths({ ...ART9, severityCompliance: null })).toContain(
        'severityCompliance'
      );
    });

    test('exige au moins un compteur de personnes concernées', () => {
      expect(
        issuePaths({
          ...ART9,
          affectedPersonsCount: null,
          affectedPatientsCount: null,
        })
      ).toContain('affectedPersonsCount');
    });

    test('accepte un compteur à 0, comme le backend', () => {
      expect(
        schema.safeParse({
          ...ART9,
          affectedPersonsCount: null,
          affectedPatientsCount: 0,
        }).success
      ).toBe(true);
    });

    test("n'applique aucune de ces règles hors art. 9", () => {
      expect(
        schema.safeParse({
          ...BASE_VALID,
          specialCategoryData: false,
          severityOverall: null,
          severityCompliance: null,
        }).success
      ).toBe(true);
    });
  });
});
