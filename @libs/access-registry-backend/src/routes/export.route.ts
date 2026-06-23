import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { boolean, number, object, string } from "zod";
import { jsonApiErrorDocumentSchema, type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { AccessRecordEntity } from "#src/entities/access-record.entity.js";
import { ExportService, type ExportFormat } from "#src/utils/export.service.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";

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
        schema: {
          body: object({
            format: string().refine((v) => VALID_FORMATS.includes(v as ExportFormat), {
              message: "format invalide (json|csv|pdf)",
            }),
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
          },
        },
      },
      async (request, reply) => {
        const user = request.user!;
        const format = request.body.format as ExportFormat;
        const generatedAt = new Date().toISOString();

        const records = await this.em
          .getRepository(AccessRecordEntity)
          .findAll({ orderBy: { seq: "ASC" } });

        const exportService = new ExportService(this.signingKey);
        const result = await exportService.build(records, format, user.id, generatedAt);

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
