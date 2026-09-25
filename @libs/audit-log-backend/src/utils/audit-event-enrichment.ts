import { jsonApiSerializeManyAuditEvents } from "#src/serializers/audit-event.serializer.js";
import type { AuditEventEntityType } from "#src/entities/audit-event.entity.js";
import { userNameFor, type UserEntityType } from "@libs/users-backend";

// Déplacé depuis access-registry-backend avec la route du journal : le nom de
// l'acteur d'un événement n'a rien de spécifique au registre d'accès.
// @lat: [[backend/audit-log#Journal exposé par son propre module]]
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
