import { http, HttpResponse } from 'msw';

const mockAuditEvents = [
  {
    id: 'ae-3',
    type: 'audit-events' as const,
    attributes: {
      occurredAt: '2026-06-15T16:15:00.000Z',
      actorId: 'e2e-login-user',
      actorName: 'E2E Login User',
      action: 'REGISTRY_CREATED',
      targetType: 'access_record',
      targetRef: 'rec-3',
      outcome: 'success',
      ip: '::1',
      userAgent: 'Mozilla/5.0',
      seq: 3,
      prevHash: 'b2c3d4e5',
      hash: 'c3d4e5f6',
    },
  },
  {
    id: 'ae-2',
    type: 'audit-events' as const,
    attributes: {
      occurredAt: '2026-06-15T16:10:00.000Z',
      actorId: 'e2e-login-user',
      actorName: 'E2E Login User',
      action: 'REGISTRY_VIEWED',
      targetType: 'access_record_list',
      targetRef: 'list',
      outcome: 'success',
      ip: '::1',
      userAgent: 'Mozilla/5.0',
      seq: 2,
      prevHash: 'a1b2c3d4',
      hash: 'b2c3d4e5',
    },
  },
  {
    id: 'ae-1',
    type: 'audit-events' as const,
    attributes: {
      occurredAt: '2026-06-15T16:00:00.000Z',
      actorId: 'e2e-login-user',
      actorName: 'E2E Login User',
      action: 'LOGIN',
      targetType: 'session',
      targetRef: 'e2e-login-user',
      outcome: 'success',
      ip: '::1',
      userAgent: 'Mozilla/5.0',
      seq: 1,
      prevHash: '00000000',
      hash: 'a1b2c3d4',
    },
  },
];

export default [
  http.get('/api/v1/audit-events', () =>
    HttpResponse.json({
      data: mockAuditEvents,
      meta: { total: mockAuditEvents.length },
    })
  ),
];
