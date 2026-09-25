import { http, HttpResponse } from 'msw';

const dataCategories = [
  {
    id: 'dc-identity',
    type: 'data-categories' as const,
    attributes: { code: 'identity', label: 'Identité', labelEn: 'Identity' },
  },
  {
    id: 'dc-contact',
    type: 'data-categories' as const,
    attributes: {
      code: 'contact',
      label: 'Contact',
      labelEn: 'Contact details',
    },
  },
  {
    id: 'dc-financial',
    type: 'data-categories' as const,
    attributes: { code: 'financial', label: 'Financier', labelEn: 'Financial' },
  },
  {
    id: 'dc-health',
    type: 'data-categories' as const,
    attributes: { code: 'health', label: 'Santé', labelEn: 'Health' },
  },
];

const purposes = [
  {
    id: 'p-support',
    type: 'purposes' as const,
    attributes: {
      code: 'support',
      label: 'Support client',
      labelEn: 'Customer support',
    },
  },
  {
    id: 'p-billing',
    type: 'purposes' as const,
    attributes: { code: 'billing', label: 'Facturation', labelEn: 'Billing' },
  },
  {
    id: 'p-legal',
    type: 'purposes' as const,
    attributes: {
      code: 'legal',
      label: 'Obligation légale',
      labelEn: 'Legal obligation',
    },
  },
];

const legalBases = [
  {
    id: 'lb-6-1-b',
    type: 'legal-bases' as const,
    attributes: {
      code: 'art6.1b',
      label: "Exécution d'un contrat (art. 6.1.b)",
      labelEn: 'Performance of a contract (art. 6.1.b)',
      isArticle9: false,
    },
  },
  {
    id: 'lb-6-1-c',
    type: 'legal-bases' as const,
    attributes: {
      code: 'art6.1c',
      label: 'Obligation légale (art. 6.1.c)',
      labelEn: 'Legal obligation (art. 6.1.c)',
      isArticle9: false,
    },
  },
  {
    id: 'lb-9-2-h',
    type: 'legal-bases' as const,
    attributes: {
      code: 'art9.2h',
      label: 'Médecine préventive (art. 9.2.h)',
      labelEn: 'Preventive medicine (art. 9.2.h)',
      isArticle9: true,
    },
  },
  {
    id: 'lb-9-2-a',
    type: 'legal-bases' as const,
    attributes: {
      code: 'art9.2a',
      label: 'Consentement explicite (art. 9.2.a)',
      labelEn: 'Explicit consent (art. 9.2.a)',
      isArticle9: true,
    },
  },
];

const sourceSystems = [
  {
    id: 'ss-crm',
    type: 'source-systems' as const,
    attributes: { code: 'crm', label: 'CRM', labelEn: 'CRM' },
  },
  {
    id: 'ss-erp',
    type: 'source-systems' as const,
    attributes: { code: 'erp', label: 'ERP', labelEn: 'ERP' },
  },
];

const eligibleAccessors = [
  {
    id: 'encoder-id',
    type: 'eligible-accessors' as const,
    attributes: { name: 'Amaury Deflorenne' },
  },
  {
    id: 'encoder-2',
    type: 'eligible-accessors' as const,
    attributes: { name: 'Jeanne Encodeuse' },
  },
];

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default [
  http.get('/api/v1/data-categories', () =>
    HttpResponse.json({ data: dataCategories })
  ),
  http.get('/api/v1/purposes', () => HttpResponse.json({ data: purposes })),
  http.get('/api/v1/legal-bases', () =>
    HttpResponse.json({ data: legalBases })
  ),
  http.get('/api/v1/source-systems', () =>
    HttpResponse.json({ data: sourceSystems })
  ),
  http.post('/api/v1/source-systems', async ({ request }) => {
    const body = (await request.json()) as {
      data: { attributes: { label: string } };
    };
    const label = body.data.attributes.label.trim();
    const code = slugify(label);
    return HttpResponse.json({
      data: {
        id: `ss-${code}`,
        type: 'source-systems' as const,
        // labelEn null comme côté backend : un système créé depuis le
        // formulaire n'a que le libellé saisi par l'utilisateur.
        attributes: { code, label, labelEn: null },
      },
    });
  }),
  http.get('/api/v1/eligible-accessors', () =>
    HttpResponse.json({ data: eligibleAccessors })
  ),
];
