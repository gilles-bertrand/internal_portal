import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { verifyIncidentChain } from "#src/utils/integrity.js";
import { boolean, number, object, string } from "zod";
import { jsonApiErrorDocumentSchema, type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { IncidentEntity } from "#src/entities/incident.entity.js";
import { requirePermission } from "@libs/permissions-backend";

export class VerifyIntegrityRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/verify-integrity",
      {
        // @lat: [[backend/incident-registry#RBAC plus strict qu'access-registry]]
        preHandler: [requirePermission("read", "IncidentIntegrity")],
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
