import type { FastifyInstanceTypeForModule } from "#src/init.js";
import type { EntityManager } from "@mikro-orm/postgresql";
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
import { IncidentEntity } from "#src/entities/incident.entity.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";
import { requirePermission } from "@libs/permissions-backend";
import { subject } from "@casl/ability";

// @lat: [[backend/incident-registry#Édition = nouvelle version (append)]]
// Édition d'un incident : AJOUTE une nouvelle version chaînée (l'original reste
// immuable). Row-level via CASL (`update Incident` conditionné `encodedBy` pour
// l'encoder, inconditionnel pour le dpo).
export class UpdateRoute implements Route {
  public constructor(
    private em: EntityManager,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.put(
      "/:id",
      {
        preHandler: [requirePermission("update", "Incident")],
        schema: {
          params: object({ id: string() }),
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
            404: jsonApiErrorDocumentSchema,
            409: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const user = request.user!;
        const { id } = request.params;
        const attrs = request.body.data.attributes;

        const record = await this.em.getRepository(IncidentEntity).findOne({ id });
        if (!record) {
          return reply.code(404).send(makeJsonApiError(404, "Not Found", { code: "NOT_FOUND" }));
        }

        // Row-level : évalue la condition `encodedBy=$user.id` de l'encoder.
        if (!request.ability!.can("update", subject("Incident", record) as never)) {
          return reply.code(403).send(makeJsonApiError(403, "Forbidden", { code: "FORBIDDEN" }));
        }

        if (record.supersededById !== null || record.deletedAt != null) {
          return reply.code(409).send(
            makeJsonApiError(409, "Conflict", {
              code: "NOT_CURRENT_VERSION",
              detail: "seule la version courante non supprimée peut être éditée",
            }),
          );
        }

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
        const newVersion = await appendService.appendNewVersion(record, input, user.id);

        await this.auditLogger.log({
          actorId: user.id,
          action: "INCIDENT_UPDATED",
          targetType: "incident",
          targetRef: newVersion.reference,
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        return reply.send(jsonApiSerializeSingleIncidentDocument(newVersion));
      },
    );
  }
}
