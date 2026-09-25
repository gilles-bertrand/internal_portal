import { describe, expect, test } from 'vitest';
import type { IntlService } from 'ember-intl';
import { createAccessRecordValidationSchema } from '#src/components/forms/access-record-validation.ts';

// IntlService minimal — retourne la clé brute comme message d'erreur.
const fakeIntl = { t: (key: string) => key } as unknown as IntlService;

const BASE_VALID = {
  accessedAt: '2026-06-10T09:30:00.000Z',
  accessorRef: 'emp-001',
  dataSubjectRef: 'cust-pseudonym-001',
  dataCategories: 'identification',
  accessType: 'consultation',
  purpose: 'support-client',
  legalBasis: 'contract',
  sourceSystem: 'CRM',
  justification: 'Demande client #4821',
};

describe('createAccessRecordValidationSchema', () => {
  const schema = createAccessRecordValidationSchema(fakeIntl);

  test('valide un enregistrement complet avec tous les champs requis', () => {
    const result = schema.safeParse(BASE_VALID);
    expect(result.success).toBe(true);
  });

  test('rejette si accessedAt est absent', () => {
    const data: Record<string, unknown> = { ...BASE_VALID };
    delete data['accessedAt'];
    const result = schema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('rejette si accessorRef est vide', () => {
    const result = schema.safeParse({ ...BASE_VALID, accessorRef: '' });
    expect(result.success).toBe(false);
  });

  test('rejette si justification est vide', () => {
    const result = schema.safeParse({ ...BASE_VALID, justification: '' });
    expect(result.success).toBe(false);
  });

  test('rejette un accessType hors énumération', () => {
    const result = schema.safeParse({ ...BASE_VALID, accessType: 'piratage' });
    expect(result.success).toBe(false);
  });

  test('accepte tous les slugs accessType valides', () => {
    for (const slug of [
      'consultation',
      'modification',
      'export',
      'transmission',
    ]) {
      const result = schema.safeParse({ ...BASE_VALID, accessType: slug });
      expect(result.success).toBe(true);
    }
  });

  // legalBasis codes come from the /legal-bases referential (fetched at
  // runtime by the route), so zod only enforces non-empty — the closed set of
  // valid codes is enforced by the select only offering fetched options, not
  // by this schema.
  test('rejette legalBasis vide', () => {
    const result = schema.safeParse({ ...BASE_VALID, legalBasis: '' });
    expect(result.success).toBe(false);
  });

  test('accepte tout code legalBasis non vide', () => {
    for (const code of ['consent', 'art6.1b', 'any-referential-code']) {
      const result = schema.safeParse({ ...BASE_VALID, legalBasis: code });
      expect(result.success).toBe(true);
    }
  });

  test('accepte une string pour dataCategories', () => {
    const result = schema.safeParse({ ...BASE_VALID, dataCategories: 'santé' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataCategories).toBe('santé');
    }
  });

  test('rejette dataCategories null', () => {
    const result = schema.safeParse({ ...BASE_VALID, dataCategories: null });
    expect(result.success).toBe(false);
  });

  test('rejette dataCategories vide', () => {
    const result = schema.safeParse({ ...BASE_VALID, dataCategories: '' });
    expect(result.success).toBe(false);
  });

  test('accepte une chaîne séparée par des virgules pour plusieurs catégories', () => {
    const result = schema.safeParse({
      ...BASE_VALID,
      dataCategories: 'identité, contact, santé',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataCategories).toBe('identité, contact, santé');
    }
  });

  test('accepte recipient et isSpecialCategory comme optionnels', () => {
    const result = schema.safeParse({
      ...BASE_VALID,
      recipient: 'Mutuelle X',
      isSpecialCategory: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recipient).toBe('Mutuelle X');
      expect(result.data.isSpecialCategory).toBe(true);
    }
  });

  test('accepte id optionnel (nullable)', () => {
    const withId = schema.safeParse({ ...BASE_VALID, id: 'existing-id' });
    const withNull = schema.safeParse({ ...BASE_VALID, id: null });
    const withoutId = schema.safeParse(BASE_VALID);
    expect(withId.success).toBe(true);
    expect(withNull.success).toBe(true);
    expect(withoutId.success).toBe(true);
  });
});
