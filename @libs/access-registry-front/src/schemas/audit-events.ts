import {
  withDefaults,
  type WithLegacy,
} from '@warp-drive/legacy/model/migration-support';
import type { Type } from '@warp-drive/core/types/symbols';

const AuditEventSchema = withDefaults({
  type: 'audit-events',
  fields: [
    { name: 'occurredAt', kind: 'attribute' },
    { name: 'actorId', kind: 'attribute' },
    { name: 'actorName', kind: 'attribute' },
    { name: 'action', kind: 'attribute' },
    { name: 'targetType', kind: 'attribute' },
    { name: 'targetRef', kind: 'attribute' },
    { name: 'outcome', kind: 'attribute' },
    { name: 'ip', kind: 'attribute' },
    { name: 'userAgent', kind: 'attribute' },
    { name: 'seq', kind: 'attribute' },
    { name: 'prevHash', kind: 'attribute' },
    { name: 'hash', kind: 'attribute' },
  ],
});

export default AuditEventSchema;

export type AuditEvent = WithLegacy<{
  occurredAt: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetRef: string;
  outcome: string;
  ip: string;
  userAgent: string | null;
  seq: number;
  prevHash: string;
  hash: string;
  [Type]: 'audit-events';
}>;
