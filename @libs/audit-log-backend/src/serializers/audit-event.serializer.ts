import { object, string } from "zod";
import { z } from "zod";
import { makeJsonApiDocumentSchema } from "@libs/backend-shared";
import type { AuditEventEntityType } from "#src/entities/audit-event.entity.js";

export const SerializedAuditEventSchema = makeJsonApiDocumentSchema(
  "audit-events",
  object({
    occurredAt: string(),
    actorId: string(),
    action: string(),
    targetType: string(),
    targetRef: string(),
    outcome: string(),
    ip: string(),
    userAgent: string().nullable(),
    seq: z.number().int(),
    prevHash: string(),
    hash: string(),
  }),
);

export function jsonApiSerializeAuditEvent(
  e: AuditEventEntityType,
): z.infer<typeof SerializedAuditEventSchema> {
  return {
    id: e.id,
    type: "audit-events" as const,
    attributes: {
      occurredAt: e.occurredAt,
      actorId: e.actorId,
      action: e.action,
      targetType: e.targetType,
      targetRef: e.targetRef,
      outcome: e.outcome,
      ip: e.ip,
      userAgent: e.userAgent ?? null,
      seq: e.seq,
      prevHash: e.prevHash,
      hash: e.hash,
    },
  };
}

export function jsonApiSerializeManyAuditEvents(events: AuditEventEntityType[]) {
  return events.map(jsonApiSerializeAuditEvent);
}
