import {
  jsonApiSerializeManyAuditEvents,
  type AuditEventEntityType,
} from "@libs/audit-log-backend";
import type { UserEntityType } from "@libs/users-backend";
import { userNameFor } from "#src/utils/user-display.js";

export function serializeAuditEventsWithActorNames(
  events: AuditEventEntityType[],
  usersById: Map<string, UserEntityType>,
) {
  return jsonApiSerializeManyAuditEvents(events).map((doc) => ({
    ...doc,
    attributes: {
      ...doc.attributes,
      actorName: userNameFor(usersById.get(doc.attributes.actorId), doc.attributes.actorId),
    },
  }));
}
