import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { boolean, number, object, string } from "zod";
import {
  canonicalSerialize,
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  verifyChain,
  type Route,
} from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { AccessRecordEntity } from "#src/entities/access-record.entity.js";

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
          .getRepository(AccessRecordEntity)
          .findAll({ orderBy: { seq: "ASC" } });

        const links = records.map((r) => ({
          hash: r.hash,
          prevHash: r.prevHash,
          canonical: canonicalSerialize({
            id: r.id,
            seq: r.seq,
            accessedAt: r.accessedAt,
            encodedAt: r.encodedAt,
            encodedBy: r.encodedBy,
            accessorRef: r.accessorRef,
            dataSubjectRef: r.dataSubjectRef,
            dataCategories: r.dataCategories,
            isSpecialCategory: r.isSpecialCategory,
            accessType: r.accessType,
            purpose: r.purpose,
            legalBasis: r.legalBasis,
            sourceSystem: r.sourceSystem,
            recipient: r.recipient,
            justification: r.justification,
            retentionUntil: r.retentionUntil,
          }),
        }));

        const broken = verifyChain(links);

        if (broken) {
          return reply.send({ ok: false, total: records.length, ...broken });
        }
        return reply.send({ ok: true, total: records.length });
      },
    );
  }
}
