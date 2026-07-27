import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { boolean, number, object, string } from "zod";
import { jsonApiErrorDocumentSchema, makeJsonApiError, type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { AccessRecordEntity } from "#src/entities/access-record.entity.js";
import { SourceSystemEntity } from "#src/entities/source-system.entity.js";
import { ExportService, type ExportFormat } from "#src/utils/export.service.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";
import { requirePermission } from "@libs/permissions-backend";

const VALID_FORMATS: ExportFormat[] = ["json", "csv", "pdf"];

export class ExportRoute implements Route {
  public constructor(
    private em: EntityManager,
    private signingKey: string,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/export",
      {
        preHandler: [requirePermission("read", "AccessRecord")],
        schema: {
          body: object({
            format: string().refine((v) => VALID_FORMATS.includes(v as ExportFormat), {
              message: "format invalide (json|csv|pdf)",
            }),
            // Périmètre de l'export : code d'un source system pour filtrer, ou
            // absent/null pour exporter tout le registre.
            sourceSystem: string().min(1).nullable().optional(),
          }),
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
                  integrityBrokenAt: number().optional(),
                  integrityReason: string().optional(),
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
        const format = request.body.format as ExportFormat;
        const sourceSystem = request.body.sourceSystem;
        const generatedAt = new Date().toISOString();

        // Périmètre : si un source system est demandé, il doit exister (sinon
        // 404) et le filtre est appliqué côté serveur. Sans paramètre, on
        // exporte tout le registre.
        if (sourceSystem) {
          const exists = await this.em
            .getRepository(SourceSystemEntity)
            .findOne({ code: sourceSystem });
          if (!exists) {
            return reply.code(404).send(
              makeJsonApiError(404, "Not Found", {
                code: "SOURCE_SYSTEM_NOT_FOUND",
                detail: `Source system "${sourceSystem}" introuvable`,
              }),
            );
          }
        }

        const repo = this.em.getRepository(AccessRecordEntity);
        const records = await repo.findAll({
          where: sourceSystem ? { sourceSystem } : {},
          orderBy: { seq: "ASC" },
        });
        // L'attestation d'intégrité porte sur la chaîne COMPLÈTE du registre :
        // sans filtre, c'est le même jeu ; avec filtre, on recharge tout pour ne
        // pas invalider à tort l'intégrité d'un sous-ensemble non contigu.
        const integrityRecords = sourceSystem
          ? await repo.findAll({ orderBy: { seq: "ASC" } })
          : records;

        const exportService = new ExportService(this.signingKey);
        const result = await exportService.build(
          records,
          format,
          user.id,
          generatedAt,
          integrityRecords,
        );

        await this.auditLogger.log({
          actorId: user.id,
          action: "REGISTRY_EXPORTED",
          targetType: "access_record_export",
          targetRef: result.manifest.contentSha256,
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        return reply.send({ data: result });
      },
    );
  }
}
