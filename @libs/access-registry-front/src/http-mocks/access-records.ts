/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { http, HttpResponse } from 'msw';

const mockAccessRecords = [
  {
    id: '1',
    type: 'access-records' as const,
    attributes: {
      accessedAt: '2026-06-10T09:30:00.000Z',
      encodedAt: '2026-06-10T09:35:00.000Z',
      encodedBy: 'encoder-1',
      accessorRef: 'emp-014',
      dataSubjectRef: 'cust-pseudonym-001',
      dataCategories: ['identité', 'contact'],
      isSpecialCategory: false,
      accessType: 'consultation',
      purpose: 'support-client',
      legalBasis: 'art6.1b',
      sourceSystem: 'CRM',
      recipient: null,
      justification: 'Demande client #4821',
      retentionUntil: '2031-06-10T09:30:00.000Z',
      seq: 1,
      prevHash:
        '0000000000000000000000000000000000000000000000000000000000000000',
      hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    },
  },
  {
    id: '2',
    type: 'access-records' as const,
    attributes: {
      accessedAt: '2026-06-11T14:00:00.000Z',
      encodedAt: '2026-06-11T14:02:00.000Z',
      encodedBy: 'encoder-2',
      accessorRef: 'emp-002',
      dataSubjectRef: 'cust-pseudonym-117',
      dataCategories: ['santé'],
      isSpecialCategory: true,
      accessType: 'transmission',
      purpose: 'remboursement',
      legalBasis: 'art9.2h',
      sourceSystem: 'Dossier médical',
      recipient: 'Mutuelle X',
      justification: 'Transmission pour remboursement',
      retentionUntil: '2036-06-11T14:00:00.000Z',
      seq: 2,
      prevHash:
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      hash: 'b2c3d4e5f6a7b2c3d4e5f6a7b2c3d4e5f6a7b2c3d4e5f6a7b2c3d4e5f6a7b2c3',
    },
  },
];

export default [
  http.get('/api/v1/access-records/:id', (req) => {
    const { id } = req.params;
    const record = mockAccessRecords.find((r) => r.id === id);
    if (record) {
      return HttpResponse.json({ data: record });
    }
    return HttpResponse.json(
      { message: 'Not Found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }),
  http.get('/api/v1/access-records', () => {
    return HttpResponse.json({
      data: mockAccessRecords,
      meta: { total: mockAccessRecords.length },
    });
  }),
  http.post('/api/v1/access-records', async (req) => {
    const json = (await req.request.json()) as Record<string, any>;
    return HttpResponse.json({
      data: {
        id: json.data.lid ?? 'new-record',
        type: 'access-records' as const,
        attributes: {
          ...json.data.attributes,
          encodedAt: new Date().toISOString(),
          encodedBy: 'current-user',
          retentionUntil: '2031-01-01T00:00:00.000Z',
          seq: mockAccessRecords.length + 1,
          prevHash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          hash: 'c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4e5f6a7b8c3d4',
        },
      },
    });
  }),
];
