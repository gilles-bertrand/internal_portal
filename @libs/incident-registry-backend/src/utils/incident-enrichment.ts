import type { IncidentEntityType } from "#src/entities/incident.entity.js";
import { jsonApiSerializeManyIncidents } from "#src/serializers/incident.serializer.js";
import type { UserEntityType } from "@libs/users-backend";
import { userNameFor } from "#src/utils/user-display.js";

export function serializeIncidentsWithUserNames(
  records: IncidentEntityType[],
  usersById: Map<string, UserEntityType>,
) {
  return jsonApiSerializeManyIncidents(records).map((doc) => ({
    ...doc,
    attributes: {
      ...doc.attributes,
      encodedByName: userNameFor(usersById.get(doc.attributes.encodedBy), doc.attributes.encodedBy),
    },
  }));
}
