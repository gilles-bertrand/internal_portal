import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { serializeAuditEventsWithActorNames } from "#src/utils/audit-event-enrichment.js";
import { canReadAuditEvent } from "#src/utils/audit-scope.js";
import { array, number, object, string } from "zod";
import { type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { AuditEventEntity } from "#src/entities/audit-event.entity.js";
import { SerializedAuditEventSchema } from "#src/serializers/audit-event.serializer.js";
import { loadUsersByIds } from "@libs/users-backend";
import { requirePermission } from "@libs/permissions-backend";

const SerializedAuditEventWithActorSchema = SerializedAuditEventSchema.extend({
  attributes: SerializedAuditEventSchema.shape.attributes.extend({
    actorName: string(),
  }),
});

// Méta-journal d'audit, tous domaines confondus.
//
// Vit désormais dans `audit-log-backend` et non plus dans le registre d'accès.
// Deux raisons, et la seconde est une faille :
//
// 1. Cette route interroge la table globale `audit_event` : la loger dans un
//    registre métier rendait le journal de TOUS les domaines indisponible dès
//    que ce registre-là n'était pas monté.
// 2. Son garde était `read AccessRecord`. Or la réponse contient les événements
//    de tous les domaines : `tech_admin`, explicitement banni du préfixe
//    `/incidents`, lisait par ce biais l'activité complète du registre
//    d'incidents. Le garde est maintenant son propre sujet, `AuditEvent`, et
//    chaque ligne est filtrée par le domaine qu'elle concerne.
//
// @lat: [[backend/audit-log#Journal exposé par son propre module]]
export class AuditEventsRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/audit-events",
      {
        preHandler: [requirePermission("read", "AuditEvent")],
        schema: {
          response: {
            200: object({
              data: array(SerializedAuditEventWithActorSchema),
              meta: object({ total: number(), filtered: number() }),
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

        // Le filtrage est fait APRÈS la requête, sur le `targetType` de chaque
        // ligne, plutôt que traduit en clause SQL : la correspondance
        // targetType → sujet CASL est une règle applicative, et une condition
        // CASL peut porter sur des champs (`encodedBy: $user.id`) qu'un `where`
        // sur `audit_event` ne saurait pas reproduire. Le journal reste petit
        // et borné par les filtres ci-dessus.
        const visible = events.filter((event) =>
          canReadAuditEvent(request.ability!, event.targetType),
        );

        const usersById = await loadUsersByIds(
          this.em,
          visible.map((event) => event.actorId),
        );

        return reply.send({
          data: serializeAuditEventsWithActorNames(visible, usersById),
          // `total` = ce que le journal contient pour ces filtres, `filtered` =
          // ce que CET appelant a le droit de voir. Les exposer séparément
          // permet à un DPO de constater qu'une partie lui est masquée, au lieu
          // de croire le journal plus court qu'il n'est.
          meta: { total, filtered: visible.length },
        });
      },
    );
  }
}
