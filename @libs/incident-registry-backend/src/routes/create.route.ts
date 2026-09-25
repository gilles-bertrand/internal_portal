import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { object, string } from "zod";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import { AppendService } from "#src/utils/append.service.js";
import {
  IncidentAttributesSchema,
  toNewIncidentInput,
  validateIncidentBusinessRules,
} from "#src/utils/incident-attributes.js";
import {
  jsonApiSerializeSingleIncidentDocument,
  SerializedIncidentSchema,
} from "#src/serializers/incident.serializer.js";
import type { EntityManager } from "@mikro-orm/postgresql";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";
import { requirePermission } from "@libs/permissions-backend";

export class CreateRoute implements Route {
  public constructor(
    private em: EntityManager,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/",
      {
        preHandler: [requirePermission("create", "Incident")],
        schema: {
          body: makeSingleJsonApiTopDocument(
            object({
              id: string().optional().nullable(),
              type: string().optional(),
              attributes: IncidentAttributesSchema,
            }),
          ),
          response: {
            200: makeSingleJsonApiTopDocument(SerializedIncidentSchema),
            400: jsonApiErrorDocumentSchema,
            403: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const attrs = request.body.data.attributes;
        const user = request.user!;

        const ruleError = validateIncidentBusinessRules(attrs);
        if (ruleError) {
          return reply.code(400).send(
            makeJsonApiError(400, "Validation Error", {
              code: ruleError.code,
              detail: ruleError.detail,
              source: { pointer: ruleError.pointer },
            }),
          );
        }

        const input = toNewIncidentInput(attrs, user.id);

        const appendService = new AppendService(this.em);
        const record = await appendService.append(input);

        await this.auditLogger.log({
          actorId: user.id,
          action: "INCIDENT_CREATED",
          targetType: "incident",
          targetRef: record.id,
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        return reply.send(jsonApiSerializeSingleIncidentDocument(record));
      },
    );
  }
}
