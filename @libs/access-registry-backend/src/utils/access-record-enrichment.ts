import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { jsonApiSerializeManyAccessRecords } from "#src/serializers/access-record.serializer.js";
import type { UserEntityType } from "@libs/users-backend";
import { userNameFor } from "#src/utils/user-display.js";

export function serializeAccessRecordsWithUserNames(
  records: AccessRecordEntityType[],
  usersById: Map<string, UserEntityType>,
) {
  return jsonApiSerializeManyAccessRecords(records).map((doc) => ({
    ...doc,
    attributes: {
      ...doc.attributes,
      encodedByName: userNameFor(usersById.get(doc.attributes.encodedBy), doc.attributes.encodedBy),
    },
  }));
}
