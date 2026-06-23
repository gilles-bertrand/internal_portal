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

interface RequestUser {
  id: string;
  role: string;
}

const SORTABLE_FIELDS = ["accessedAt", "encodedAt", "seq"] as const;

function applyDirectFilters(
  q: Record<string, string | undefined>,
  where: Record<string, unknown>,
): void {
  const directFilters = [
    { param: "filter[dataSubjectRef]", field: "dataSubjectRef" },
    { param: "filter[accessType]", field: "accessType" },
    { param: "filter[purpose]", field: "purpose" },
  ] as const;

  for (const { param, field } of directFilters) {
    if (q[param]) where[field] = q[param];
  }

  if (q["filter[isSpecialCategory]"]) {
    where["isSpecialCategory"] = q["filter[isSpecialCategory]"] === "true";
  }
}

function applyDateRangeFilter(
  q: Record<string, string | undefined>,
  where: Record<string, unknown>,
): void {
  const from = q["filter[from]"];
  const to = q["filter[to]"];
  if (!from && !to) return;

  const range: Record<string, string> = {};
  if (from) range["$gte"] = from;
  if (to) range["$lte"] = to;
  where["accessedAt"] = range;
}

function buildWhereFilters(
  q: Record<string, string | undefined>,
  user: RequestUser,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (user.role === "encoder") {
    where["encodedBy"] = user.id;
  }

  if (q["filter[encodedBy]"] && user.role !== "encoder") {
    where["encodedBy"] = q["filter[encodedBy]"];
  }

  applyDirectFilters(q, where);
  applyDateRangeFilter(q, where);

  return where;
}

function parseSortParam(sortParam: string | undefined): Record<string, "ASC" | "DESC"> {
  if (!sortParam) return { seq: "ASC" };

  const desc = sortParam.startsWith("-");
  const field = desc ? sortParam.slice(1) : sortParam;

  if (!SORTABLE_FIELDS.includes(field as (typeof SORTABLE_FIELDS)[number])) {
    return { seq: "ASC" };
  }

  return { [field]: desc ? "DESC" : "ASC" };
}

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
        const where = buildWhereFilters(q, user);
        const orderBy = parseSortParam(q["sort"]);

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
