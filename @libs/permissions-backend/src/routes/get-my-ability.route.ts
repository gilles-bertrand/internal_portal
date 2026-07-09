import { array, boolean, object, record, string, union, unknown } from "zod";
import { jsonApiErrorDocumentSchema, makeJsonApiError, type Route } from "@libs/backend-shared";
import type { FastifyInstanceTypeForModule } from "#src/init.js";

// action/subject sont typés `string | string[]` par CASL (RawRule) même si
// buildAbility() ne produit aujourd'hui que des règles à action/sujet unique.
const AbilityRuleSchema = object({
  action: union([string(), array(string())]),
  subject: union([string(), array(string())]),
  conditions: record(string(), unknown()).optional(),
  inverted: boolean().optional(),
});

// @lat: [[backend/permissions#Route GET /me/ability]]
export class GetMyAbilityRoute implements Route {
  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/ability",
      {
        schema: {
          response: {
            200: object({ data: object({ rules: array(AbilityRuleSchema) }) }),
            401: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        if (!request.ability) {
          return reply.code(401).send(
            makeJsonApiError(401, "Unauthorized", {
              code: "UNAUTHORIZED",
              detail: "Not authenticated",
            }),
          );
        }

        return reply.send({ data: { rules: request.ability.rules } });
      },
    );
  }
}
