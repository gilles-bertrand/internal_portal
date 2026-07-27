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
  jsonApiSerializeSingleIncidentDocument,
  SerializedIncidentSchema,
} from "#src/serializers/incident.serializer.js";
import { IncidentEntity } from "#src/entities/incident.entity.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";
import { requirePermission } from "@libs/permissions-backend";

// @lat: [[backend/incident-registry#Suppression = soft-delete + restauration]]
// Restauration d'un incident soft-supprimé — réservée au DPO (action CASL
// `restore Incident`, seedée pour dpo uniquement).
export class RestoreRoute implements Route {
  public constructor(
    private em: EntityManager,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/:id/restore",
      {
        preHandler: [requirePermission("restore", "Incident")],
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

        const repo = this.em.getRepository(IncidentEntity);
        const record = await repo.findOne({ id });
        if (!record) {
          return reply.code(404).send(makeJsonApiError(404, "Not Found", { code: "NOT_FOUND" }));
        }

        if (record.deletedAt != null) {
          const appendService = new AppendService(this.em);
          await appendService.restore(id);

          await this.auditLogger.log({
            actorId: user.id,
            action: "INCIDENT_RESTORED",
            targetType: "incident",
            targetRef: record.reference,
            outcome: "success",
            ip: request.ip,
            userAgent: request.headers["user-agent"] ?? null,
          });
        }

        const restored = await repo.findOne({ id });
        return reply.send(jsonApiSerializeSingleIncidentDocument(restored!));
      },
    );
  }
}
