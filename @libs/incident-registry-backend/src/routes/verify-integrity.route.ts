import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { verifyIncidentChain } from "#src/utils/integrity.js";
import { boolean, number, object, string } from "zod";
import { jsonApiErrorDocumentSchema, makeJsonApiError, type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { IncidentEntity } from "#src/entities/incident.entity.js";

export class VerifyIntegrityRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/verify-integrity",
      {
        schema: {
          response: {
            200: object({
              ok: boolean(),
              total: number(),
              brokenAt: number().optional(),
              reason: string().optional(),
            }),
            403: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const user = request.user!;
        if (user.role !== "auditor" && user.role !== "dpo") {
          return reply.code(403).send(makeJsonApiError(403, "Forbidden", { code: "FORBIDDEN" }));
        }

        const records = await this.em
          .getRepository(IncidentEntity)
          .findAll({ orderBy: { seq: "ASC" } });

        const result = verifyIncidentChain(records);

        if (!result.ok) {
          return reply.send(result);
        }
        return reply.send({ ok: true, total: result.total });
      },
    );
  }
}
