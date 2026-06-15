import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { array, boolean, nullable, object, string } from "zod";
import {
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import { AppendService } from "#src/utils/append.service.js";
import {
  jsonApiSerializeSingleAccessRecordDocument,
  SerializedAccessRecordSchema,
} from "#src/serializers/access-record.serializer.js";
import type { EntityManager } from "@mikro-orm/core";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";

export class CreateRoute implements Route {
  public constructor(
    private em: EntityManager,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/",
      {
        schema: {
          body: makeSingleJsonApiTopDocument(
            object({
              id: string().optional().nullable(),
              type: string().optional(),
              attributes: object({
                accessedAt: string().datetime(),
                accessorRef: string().min(1),
                dataSubjectRef: string().min(1),
                dataCategories: array(string()).min(1),
                isSpecialCategory: boolean(),
                accessType: string().refine(
                  (v) =>
                    ["consultation", "modification", "export", "transmission"].includes(v),
                  { message: "accessType invalide" },
                ),
                purpose: string().min(1),
                legalBasis: string().min(1),
                sourceSystem: string().min(1),
                recipient: nullable(string()).optional(),
                justification: string().min(1),
              }),
            }),
          ),
          response: {
            200: makeSingleJsonApiTopDocument(SerializedAccessRecordSchema),
          },
        },
      },
      async (request, reply) => {
        const attrs = request.body.data.attributes;
        const user = request.user!;

        if (user.role !== "encoder") {
          return reply.code(403).send(
            makeJsonApiError(403, "Forbidden", {
              code: "FORBIDDEN",
              detail: "seul le rôle encoder peut créer des enregistrements",
            }),
          );
        }

        if (attrs.accessType === "transmission" && !attrs.recipient) {
          return reply.code(400).send(
            makeJsonApiError(400, "Validation Error", {
              code: "MISSING_RECIPIENT",
              detail: "recipient est requis pour accessType=transmission",
              source: { pointer: "/data/attributes/recipient" },
            }),
          );
        }

        if (attrs.isSpecialCategory) {
          const art9Bases = ["art9.2a", "art9.2b", "art9.2c", "art9.2d", "art9.2e",
            "art9.2f", "art9.2g", "art9.2h", "art9.2i", "art9.2j"];
          if (!art9Bases.some((b) => attrs.legalBasis.startsWith(b) || attrs.legalBasis === b)) {
            return reply.code(400).send(
              makeJsonApiError(400, "Validation Error", {
                code: "MISSING_ART9_BASIS",
                detail: "une base légale art. 9.2 est requise pour les données spéciales",
                source: { pointer: "/data/attributes/legalBasis" },
              }),
            );
          }
        }

        const appendService = new AppendService(this.em);
        const record = await appendService.append({
          accessedAt: attrs.accessedAt,
          encodedBy: user.id,
          accessorRef: attrs.accessorRef,
          dataSubjectRef: attrs.dataSubjectRef,
          dataCategories: attrs.dataCategories,
          isSpecialCategory: attrs.isSpecialCategory,
          accessType: attrs.accessType,
          purpose: attrs.purpose,
          legalBasis: attrs.legalBasis,
          sourceSystem: attrs.sourceSystem,
          recipient: attrs.recipient ?? null,
          justification: attrs.justification,
        });

        await this.auditLogger.log({
          actorId: user.id,
          action: "REGISTRY_CREATED",
          targetType: "access_record",
          targetRef: record.id,
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        return reply.send(jsonApiSerializeSingleAccessRecordDocument(record));
      },
    );
  }
}
