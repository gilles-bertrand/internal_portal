import type { FastifyInstanceTypeForModule } from "#src/init.js";
import type { EntityRepository } from "@mikro-orm/core";
import { object, string } from "zod";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import {
  jsonApiSerializeSingleAccessRecordDocument,
  SerializedAccessRecordSchema,
} from "#src/serializers/access-record.serializer.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";

export class GetRoute implements Route {
  public constructor(
    private repository: EntityRepository<AccessRecordEntityType>,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/:id",
      {
        schema: {
          params: object({ id: string() }),
          response: {
            200: makeSingleJsonApiTopDocument(SerializedAccessRecordSchema),
            403: jsonApiErrorDocumentSchema,
            404: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const user = request.user!;
        const { id } = request.params;

        const record = await this.repository.findOne({ id });
        if (!record) {
          return reply.code(404).send(makeJsonApiError(404, "Not Found", { code: "NOT_FOUND" }));
        }

        if (user.role === "encoder" && record.encodedBy !== user.id) {
          return reply.code(403).send(makeJsonApiError(403, "Forbidden", { code: "FORBIDDEN" }));
        }

        await this.auditLogger.log({
          actorId: user.id,
          action: "REGISTRY_VIEWED",
          targetType: "access_record",
          targetRef: id,
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        return reply.send(jsonApiSerializeSingleAccessRecordDocument(record));
      },
    );
  }
}
