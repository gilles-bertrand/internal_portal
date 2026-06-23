import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { boolean, number, object, string } from "zod";
import { jsonApiErrorDocumentSchema, makeJsonApiError, type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { IncidentEntity } from "#src/entities/incident.entity.js";
import { ExportService } from "#src/utils/export.service.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";

export class ExportOneRoute implements Route {
  public constructor(
    private em: EntityManager,
    private signingKey: string,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/:id/export",
      {
        schema: {
          params: object({ id: string() }),
          response: {
            200: object({
              data: object({
                format: string(),
                encoding: string(),
                content: string(),
                manifest: object({
                  generatedAt: string(),
                  generatedBy: string(),
                  count: number(),
                  chainHeadHash: string(),
                  contentSha256: string(),
                  integrityOk: boolean(),
                }),
                signature: string(),
              }),
            }),
            403: jsonApiErrorDocumentSchema,
            404: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const user = request.user!;
        const { id } = request.params;
        const generatedAt = new Date().toISOString();

        const incident = await this.em.getRepository(IncidentEntity).findOne({ id });
        if (!incident) {
          return reply.code(404).send(makeJsonApiError(404, "Not Found", { code: "NOT_FOUND" }));
        }

        const exportService = new ExportService(this.signingKey);
        const result = await exportService.buildOne(incident, user.id, generatedAt);

        await this.auditLogger.log({
          actorId: user.id,
          action: "INCIDENT_EXPORTED",
          targetType: "incident",
          targetRef: id,
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        return reply.send({ data: result });
      },
    );
  }
}
