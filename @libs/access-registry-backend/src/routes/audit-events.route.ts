import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { serializeAuditEventsWithActorNames } from "#src/utils/audit-event-enrichment.js";
import { loadUsersByIds } from "#src/utils/user-display.js";
import { array, number, object, string } from "zod";
import { type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { AuditEventEntity, SerializedAuditEventSchema } from "@libs/audit-log-backend";

const SerializedAuditEventWithActorSchema = SerializedAuditEventSchema.extend({
  attributes: SerializedAuditEventSchema.shape.attributes.extend({
    actorName: string(),
  }),
});

export class AuditEventsRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/audit-events",
      {
        schema: {
          response: {
            200: object({
              data: array(SerializedAuditEventWithActorSchema),
              meta: object({ total: number() }),
            }),
          },
        },
      },
      async (request, reply) => {
        const q = request.query as Record<string, string | undefined>;

        const where: Record<string, unknown> = {};
        if (q["filter[action]"]) where["action"] = q["filter[action]"];
        if (q["filter[actorId]"]) where["actorId"] = q["filter[actorId]"];

        const repo = this.em.getRepository(AuditEventEntity);
        // Plus récent en premier (le méta-journal est chronologique inversé).
        const [events, total] = await repo.findAndCount(where, {
          orderBy: { seq: "DESC" },
        });

        const usersById = await loadUsersByIds(
          this.em,
          events.map((event) => event.actorId),
        );

        return reply.send({
          data: serializeAuditEventsWithActorNames(events, usersById),
          meta: { total },
        });
      },
    );
  }
}
