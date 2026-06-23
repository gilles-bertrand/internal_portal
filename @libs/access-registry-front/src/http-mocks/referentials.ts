import { http, HttpResponse } from 'msw';

const dataCategories = [
  {
    id: 'dc-identity',
    type: 'data-categories' as const,
    attributes: { code: 'identity', label: 'Identité' },
  },
  {
    id: 'dc-contact',
    type: 'data-categories' as const,
    attributes: { code: 'contact', label: 'Contact' },
  },
  {
    id: 'dc-financial',
    type: 'data-categories' as const,
    attributes: { code: 'financial', label: 'Financier' },
  },
  {
    id: 'dc-health',
    type: 'data-categories' as const,
    attributes: { code: 'health', label: 'Santé' },
  },
];

const purposes = [
  {
    id: 'p-support',
    type: 'purposes' as const,
    attributes: { code: 'support', label: 'Support client' },
  },
  {
    id: 'p-billing',
    type: 'purposes' as const,
    attributes: { code: 'billing', label: 'Facturation' },
  },
  {
    id: 'p-legal',
    type: 'purposes' as const,
    attributes: { code: 'legal', label: 'Obligation légale' },
  },
];

const legalBases = [
  {
    id: 'lb-6-1-b',
    type: 'legal-bases' as const,
    attributes: {
      code: 'art6.1b',
      label: "Exécution d'un contrat (art. 6.1.b)",
      isArticle9: false,
    },
  },
  {
    id: 'lb-6-1-c',
    type: 'legal-bases' as const,
    attributes: {
      code: 'art6.1c',
      label: 'Obligation légale (art. 6.1.c)',
      isArticle9: false,
    },
  },
  {
    id: 'lb-9-2-h',
    type: 'legal-bases' as const,
    attributes: {
      code: 'art9.2h',
      label: 'Médecine préventive (art. 9.2.h)',
      isArticle9: true,
    },
  },
  {
    id: 'lb-9-2-a',
    type: 'legal-bases' as const,
    attributes: {
      code: 'art9.2a',
      label: 'Consentement explicite (art. 9.2.a)',
      isArticle9: true,
    },
  },
];

export default [
  http.get('/api/v1/data-categories', () =>
    HttpResponse.json({ data: dataCategories })
  ),
  http.get('/api/v1/purposes', () => HttpResponse.json({ data: purposes })),
  http.get('/api/v1/legal-bases', () =>
    HttpResponse.json({ data: legalBases })
  ),
];
