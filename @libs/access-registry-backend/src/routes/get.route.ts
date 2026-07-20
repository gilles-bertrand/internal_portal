import type { FastifyInstanceTypeForModule } from "#src/init.js";
import type { EntityRepository } from "@mikro-orm/core";
import { object, string } from "zod";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import {
  jsonApiSerializeSingleAccessRecordDocument,
  SerializedAccessRecordSchema,
} from "#src/serializers/access-record.serializer.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";
import { requirePermission } from "@libs/permissions-backend";
import { subject } from "@casl/ability";
import { UserEntity } from "@libs/users-backend";
import { userNameFor } from "#src/utils/user-display.js";

export class GetRoute implements Route {
  public constructor(
    private repository: EntityRepository<AccessRecordEntityType>,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/:id",
      {
        preHandler: [requirePermission("read", "AccessRecord")],
        schema: {
          params: object({ id: string() }),
          response: {
            200: makeSingleJsonApiTopDocument(SerializedAccessRecordSchema),
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

        // `subject()` tags le record avec son type pour que CASL évalue la condition
        // `encodedBy: "$user.id"` de la règle `encoder` contre l'instance réelle — le
        // tuple `[string, string]` de l'ability type le 2e paramètre en `string` pur.
        if (!request.ability!.can("read", subject("AccessRecord", record) as never)) {
          return reply.code(403).send(makeJsonApiError(403, "Forbidden", { code: "FORBIDDEN" }));
        }

        await this.auditLogger.log({
          actorId: user.id,
          action: "REGISTRY_VIEWED",
          targetType: "access_record",
          targetRef: id,
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        // Résout le nom d'affichage de l'encodeur (l'attribut `encodedBy` ne porte
        // que l'UUID) pour l'afficher côté détail plutôt qu'un identifiant brut.
        const encoder = await this.repository
          .getEntityManager()
          .getRepository(UserEntity)
          .findOne({ id: record.encodedBy });

        const document = jsonApiSerializeSingleAccessRecordDocument(record);
        return reply.send({
          data: {
            ...document.data,
            attributes: {
              ...document.data.attributes,
              encodedByName: userNameFor(encoder ?? undefined, record.encodedBy),
            },
          },
        });
      },
    );
  }
}
