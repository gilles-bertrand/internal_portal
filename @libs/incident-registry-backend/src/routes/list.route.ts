import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { serializeIncidentsWithUserNames } from "#src/utils/incident-enrichment.js";
import { loadUsersByIds } from "#src/utils/user-display.js";
import type { EntityManager } from "@mikro-orm/postgresql";
import { array, number, object, string } from "zod";
import { type Route } from "@libs/backend-shared";
import { IncidentEntity } from "#src/entities/incident.entity.js";
import { SerializedIncidentSchema } from "#src/serializers/incident.serializer.js";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";

const SerializedIncidentWithUserSchema = SerializedIncidentSchema.extend({
  attributes: SerializedIncidentSchema.shape.attributes.extend({
    encodedByName: string(),
  }),
});

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
              data: array(SerializedIncidentWithUserSchema),
              meta: object({ total: number() }),
            }),
          },
        },
      },
      async (request, reply) => {
        const user = request.user!;
        const q = request.query as Record<string, string | undefined>;

        const where: Record<string, unknown> = {};

        if (q["filter[status]"]) where["status"] = q["filter[status]"];
        if (q["filter[clientCode]"]) where["clientCode"] = q["filter[clientCode]"];
        if (q["filter[specialCategoryData]"]) {
          where["specialCategoryData"] = q["filter[specialCategoryData]"] === "true";
        }
        if (q["filter[from]"] || q["filter[to]"]) {
          const range: Record<string, string> = {};
          if (q["filter[from]"]) range["$gte"] = q["filter[from]"]!;
          if (q["filter[to]"]) range["$lte"] = q["filter[to]"]!;
          where["reportDate"] = range;
        }

        const search = q["filter[search]"]?.trim();
        if (search) {
          const like = { $ilike: `%${search}%` };
          where["$or"] = [
            { reference: like },
            { clientCode: like },
            { clientName: like },
            { applicationName: like },
            { applicationDetail: like },
            { reportedBy: like },
            { description: like },
            { impactSummary: like },
            { status: like },
          ];
        }

        const SORTABLE = [
          "reportDate",
          "encodedAt",
          "encodedBy",
          "reference",
          "clientCode",
          "status",
          "classification",
          "environment",
          "specialCategoryData",
          "seq",
        ];
        const orderBy: Record<string, "ASC" | "DESC"> = {};
        const sortParam = q["sort"];
        if (sortParam) {
          for (const part of sortParam.split(",")) {
            const desc = part.startsWith("-");
            const field = desc ? part.slice(1) : part;
            const sortField = field === "encodedByName" ? "encodedBy" : field;
            if (SORTABLE.includes(sortField)) {
              orderBy[sortField] = desc ? "DESC" : "ASC";
            }
          }
        }
        if (Object.keys(orderBy).length === 0) {
          orderBy["seq"] = "DESC";
        }

        const pageSize = Math.min(Math.max(Number(q["page[size]"]) || 30, 1), 200);
        const pageNumber = Math.max(Number(q["page[number]"]) || 1, 1);

        const repo = this.em.getRepository(IncidentEntity);
        const [records, total] = await repo.findAndCount(where, {
          orderBy,
          limit: pageSize,
          offset: (pageNumber - 1) * pageSize,
        });

        await this.auditLogger.log({
          actorId: user.id,
          action: "INCIDENT_VIEWED",
          targetType: "incident_list",
          targetRef: "list",
          outcome: "success",
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
        });

        const usersById = await loadUsersByIds(
          this.em,
          records.map((record) => record.encodedBy),
        );

        return reply.send({
          data: serializeIncidentsWithUserNames(records, usersById),
          meta: { total },
        });
      },
    );
  }
}
