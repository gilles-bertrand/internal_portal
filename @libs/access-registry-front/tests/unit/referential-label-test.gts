import { describe, expect, test } from 'vitest';
import {
  labelForCode,
  localizedLabel,
  prefersEnglish,
} from '#src/utils/referential-label.ts';

const purposes = [
  { code: 'support', label: 'Support client', labelEn: 'Customer support' },
  { code: 'billing', label: 'Facturation', labelEn: null },
];

describe('referential-label', function () {
  test('rend le libellé anglais en locale anglaise', function () {
    expect(localizedLabel(purposes[0]!, 'en-us')).toBe('Customer support');
    expect(localizedLabel(purposes[0]!, 'fr-fr')).toBe('Support client');
  });
  test('retombe sur le français quand labelEn est absent', function () {
    expect(localizedLabel(purposes[1]!, 'en-us')).toBe('Facturation');
  });

  test('reconnaît les variantes de locale anglaise', function () {
    expect(prefersEnglish('en-us')).toBe(true);
    expect(prefersEnglish('EN-GB')).toBe(true);
    expect(prefersEnglish('fr-fr')).toBe(false);
    expect(prefersEnglish(undefined)).toBe(false);
  });
  test('résout un code en libellé, ou le rend tel quel si inconnu', function () {
    expect(labelForCode(purposes, 'support', 'fr-fr')).toBe('Support client');
    expect(labelForCode(purposes, 'disparu', 'fr-fr')).toBe('disparu');
    expect(labelForCode(undefined, 'support', 'fr-fr')).toBe('support');
    expect(labelForCode(purposes, null, 'fr-fr')).toBe('');
  });
});
