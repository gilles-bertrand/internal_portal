import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { array, number, object, string } from "zod";
import { type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/core";

export class StatsRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/stats",
      {
        schema: {
          response: {
            200: object({
              total: number(),
              specialCategoryCount: number(),
              byAccessType: array(object({ accessType: string(), count: number() })),
              byPurpose: array(object({ purpose: string(), count: number() })),
              specialCategoryRatio: number(),
            }),
          },
        },
      },
      async (_request, reply) => {
        const knex = this.em.getConnection().getKnex();

        const [totalRow] = await knex("access_record").count("id as count");
        const total = Number(totalRow?.["count"] ?? 0);

        const [specialRow] = await knex("access_record")
          .where("is_special_category", true)
          .count("id as count");
        const specialCategoryCount = Number(specialRow?.["count"] ?? 0);

        const byAccessType = await knex("access_record")
          .select("access_type as accessType")
          .count("id as count")
          .groupBy("access_type");

        const byPurpose = await knex("access_record")
          .select("purpose")
          .count("id as count")
          .groupBy("purpose");

        return reply.send({
          total,
          specialCategoryCount,
          byAccessType: byAccessType.map((r) => ({
            accessType: String(r["accessType"]),
            count: Number(r["count"]),
          })),
          byPurpose: byPurpose.map((r) => ({
            purpose: String(r["purpose"]),
            count: Number(r["count"]),
          })),
          specialCategoryRatio: total > 0 ? specialCategoryCount / total : 0,
        });
      },
    );
  }
}
