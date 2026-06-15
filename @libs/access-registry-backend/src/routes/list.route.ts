import type { FastifyInstanceTypeForModule } from "#src/init.js";
import type { EntityManager } from "@mikro-orm/postgresql";
import { array, number, object } from "zod";
import { type Route } from "@libs/backend-shared";
import { AccessRecordEntity } from "#src/entities/access-record.entity.js";
import {
  jsonApiSerializeManyAccessRecords,
  SerializedAccessRecordSchema,
} from "#src/serializers/access-record.serializer.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";

export class ListRoute implements Route {
  public constructor(
    private em: EntityManager,
    private auditLogger: AuditLogger,
  ) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/",
      {
        schema: {
          response: {
            200: object({
              data: array(SerializedAccessRecordSchema),
              meta: object({ total: number() }),
            }),
          },
        },
      },
      async (request, reply) => {
        const user = request.user!;
        const q = request.query as Record<string, string | undefined>;

        const where: Record<string, unknown> = {};

        if (user.role === "encoder") {
          where["encodedBy"] = user.id;
        }

        if (q["filter[dataSubjectRef]"]) where["dataSubjectRef"] = q["filter[dataSubjectRef]"];
        if (q["filter[encodedBy]"] && user.role !== "encoder")
          where["encodedBy"] = q["filter[encodedBy]"];
        if (q["filter[accessType]"]) where["accessType"] = q["filter[accessType]"];
        if (q["filter[isSpecialCategory]"]) {
          where["isSpecialCategory"] = q["filter[isSpecialCategory]"] === "true";
        }
        if (q["filter[purpose]"]) where["purpose"] = q["filter[purpose]"];
        if (q["filter[from]"] || q["filter[to]"]) {
          const range: Record<string, string> = {};
          if (q["filter[from]"]) range["$gte"] = q["filter[from]"]!;
          if (q["filter[to]"]) range["$lte"] = q["filter[to]"]!;
          where["accessedAt"] = range;
        }

        const sortParam = q["sort"];
        let orderBy: Record<string, "ASC" | "DESC"> = { seq: "ASC" };
        if (sortParam) {
          const desc = sortParam.startsWith("-");
          const field = desc ? sortParam.slice(1) : sortParam;
          const allowed = ["accessedAt", "encodedAt", "seq"];
          if (allowed.includes(field)) {
            orderBy = { [field]: desc ? "DESC" : "ASC" };
          }
        }

        const repo = this.em.getRepository(AccessRecordEntity);
        const [records, total] = await repo.findAndCount(where, { orderBy });

        await this.auditLogger.log({
          actorId: user.id,
          action: "REGISTRY_VIEWED",
          targetType: "access_record_list",
          targetRef: "list",
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        return reply.send({
          data: jsonApiSerializeManyAccessRecords(records),
          meta: { total },
        });
      },
    );
  }
}
