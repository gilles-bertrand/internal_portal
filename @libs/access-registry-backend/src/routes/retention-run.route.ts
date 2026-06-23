import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { number, object, string } from "zod";
import { jsonApiErrorDocumentSchema, makeJsonApiError, type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { AccessRecordEntity } from "#src/entities/access-record.entity.js";
import { ExportService } from "#src/utils/export.service.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";

export class RetentionRunRoute implements Route {
  public constructor(
    private em: EntityManager,
    private signingKey: string,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/retention/run",
      {
        schema: {
          response: {
            200: object({
              data: object({
                expiredCount: number(),
                archivedAt: string(),
                // Décision de conception : archivage signé SANS suppression physique.
                // Le registre est append-only chaîné ; supprimer un maillon casserait
                // la chaîne. La purge effective est différée (opération DBA hors app).
                // L'archive signée + l'event RETENTION_PURGE (méta-journal inviolable)
                // tracent les enregistrements échus.
                purged: number(),
                archive: object({
                  content: string(),
                  signature: string(),
                  manifest: object({
                    generatedAt: string(),
                    generatedBy: string(),
                    count: number(),
                    chainHeadHash: string(),
                    contentSha256: string(),
                  }),
                }),
              }),
            }),
            403: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const user = request.user!;
        if (user.role !== "dpo") {
          return reply.code(403).send(makeJsonApiError(403, "Forbidden", { code: "FORBIDDEN" }));
        }

        const now = new Date().toISOString();

        const expired = await this.em
          .getRepository(AccessRecordEntity)
          .find({ retentionUntil: { $lt: now } }, { orderBy: { seq: "ASC" } });

        const exportService = new ExportService(this.signingKey);
        const archive = await exportService.build(expired, "json", user.id, now);

        await this.auditLogger.log({
          actorId: user.id,
          action: "RETENTION_PURGE",
          targetType: "access_record_retention",
          targetRef: archive.manifest.contentSha256,
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        return reply.send({
          data: {
            expiredCount: expired.length,
            archivedAt: now,
            purged: 0,
            archive: {
              content: archive.content,
              signature: archive.signature,
              manifest: archive.manifest,
            },
          },
        });
      },
    );
  }
}
