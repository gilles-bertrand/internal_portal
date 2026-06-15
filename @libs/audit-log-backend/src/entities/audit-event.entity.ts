import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const AuditEventEntity = defineEntity({
  name: "AuditEvent",
  tableName: "audit_event",
  properties: {
    id: p.string().primary(),
    seq: p.integer().unique(),
    occurredAt: p.string(),
    actorId: p.string(),
    action: p.string(),
    targetType: p.string(),
    targetRef: p.string(),
    outcome: p.string(),
    ip: p.string(),
    userAgent: p.string().nullable(),
    prevHash: p.string(),
    hash: p.string().unique(),
  },
});

export type AuditEventEntityType = InferEntity<typeof AuditEventEntity>;
