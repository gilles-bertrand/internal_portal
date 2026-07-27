import type { FastifyInstanceTypeForModule } from "#src/init.js";
import type { EntityManager } from "@mikro-orm/postgresql";
import { object, string } from "zod";
import { jsonApiErrorDocumentSchema, makeJsonApiError, type Route } from "@libs/backend-shared";
import { AppendService } from "#src/utils/append.service.js";
import { IncidentEntity } from "#src/entities/incident.entity.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";
import { requirePermission } from "@libs/permissions-backend";
import { subject } from "@casl/ability";

// @lat: [[backend/incident-registry#Suppression = soft-delete + restauration]]
// Soft-delete : pose deletedAt/deletedBy (non canoniques). Aucun DELETE physique
// (la chaîne de hash et l'historique restent intacts). Row-level via CASL.
export class DeleteRoute implements Route {
  public constructor(
    private em: EntityManager,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.delete(
      "/:id",
      {
        preHandler: [requirePermission("delete", "Incident")],
        schema: {
          params: object({ id: string() }),
          response: {
            200: object({ data: object({ id: string(), type: string() }) }),
            403: jsonApiErrorDocumentSchema,
            404: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const user = request.user!;
        const { id } = request.params;

        const record = await this.em.getRepository(IncidentEntity).findOne({ id });
        if (!record) {
          return reply.code(404).send(makeJsonApiError(404, "Not Found", { code: "NOT_FOUND" }));
        }

        if (!request.ability!.can("delete", subject("Incident", record) as never)) {
          return reply.code(403).send(makeJsonApiError(403, "Forbidden", { code: "FORBIDDEN" }));
        }

        // Idempotent : si déjà supprimé, on ne re-journalise pas.
        if (record.deletedAt == null) {
          const appendService = new AppendService(this.em);
          await appendService.softDelete(id, user.id);

          await this.auditLogger.log({
            actorId: user.id,
            action: "INCIDENT_DELETED",
            targetType: "incident",
            targetRef: record.reference,
            outcome: "success",
            ip: request.ip,
            userAgent: request.headers["user-agent"] ?? null,
          });
        }

        return reply.send({ data: { id, type: "incidents" } });
      },
    );
  }
}
