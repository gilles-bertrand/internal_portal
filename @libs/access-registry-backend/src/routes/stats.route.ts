import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { array, number, object, string } from "zod";
import { type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";

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
        const [totalRow] = await this.em.execute<{ count: string }[]>(
          'SELECT COUNT(id) as count FROM "access_record"',
          [],
          "all",
        );
        const total = Number(totalRow?.count ?? 0);

        const [specialRow] = await this.em.execute<{ count: string }[]>(
          'SELECT COUNT(id) as count FROM "access_record" WHERE is_special_category = true',
          [],
          "all",
        );
        const specialCategoryCount = Number(specialRow?.count ?? 0);

        const byAccessType = await this.em.execute<{ accessType: string; count: string }[]>(
          'SELECT access_type as "accessType", COUNT(id) as count FROM "access_record" GROUP BY access_type',
          [],
          "all",
        );
        const byPurpose = await this.em.execute<{ purpose: string; count: string }[]>(
          'SELECT purpose, COUNT(id) as count FROM "access_record" GROUP BY purpose',
          [],
          "all",
        );

        return reply.send({
          total,
          specialCategoryCount,
          byAccessType: byAccessType.map((r) => ({
            accessType: r.accessType,
            count: Number(r.count),
          })),
          byPurpose: byPurpose.map((r) => ({
            purpose: r.purpose,
            count: Number(r.count),
          })),
          specialCategoryRatio: total > 0 ? specialCategoryCount / total : 0,
        });
      },
    );
  }
}
