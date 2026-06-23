import type { FastifyInstanceTypeForModule } from "#src/init.js";
import type { EntityRepository } from "@mikro-orm/core";
import { object, string } from "zod";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";
import {
  jsonApiSerializeSingleIncidentDocument,
  SerializedIncidentSchema,
} from "#src/serializers/incident.serializer.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";

export class GetRoute implements Route {
  public constructor(
    private repository: EntityRepository<IncidentEntityType>,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/:id",
      {
        schema: {
          params: object({ id: string() }),
          response: {
            200: makeSingleJsonApiTopDocument(SerializedIncidentSchema),
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

        await this.auditLogger.log({
          actorId: user.id,
          action: "INCIDENT_VIEWED",
          targetType: "incident",
          targetRef: id,
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        return reply.send(jsonApiSerializeSingleIncidentDocument(record));
      },
    );
  }
}
