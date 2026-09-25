import type { EntityManager } from "@mikro-orm/postgresql";
import { array, boolean, number, object, string, z } from "zod";
import { jsonApiErrorDocumentSchema, makeJsonApiError, type Route } from "@libs/backend-shared";
import { randomUUID } from "crypto";
import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { RoleEntity } from "#src/entities/role.entity.js";
import { PermissionRuleEntity } from "#src/entities/permission-rule.entity.js";
import {
  jsonApiSerializeSingleRoleDocument,
  SerializedRoleSchema,
} from "#src/serializers/role.serializer.js";

const ruleInputSchema = object({
  action: string(),
  subject: string(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  fields: array(string()).nullable().optional(),
  inverted: boolean().optional(),
  order: number().optional(),
});

// @lat: [[backend/permissions#Édition de la matrice de permissions]]
export class UpdateRoleRulesRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.put(
      "/:id/rules",
      {
        schema: {
          params: object({ id: string() }),
          body: object({ data: array(ruleInputSchema) }),
          response: {
            200: object({ data: SerializedRoleSchema }),
            404: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const { id } = request.params;
        const role = await this.em.getRepository(RoleEntity).findOne({ id });

        if (!role) {
          return reply.code(404).send(
            makeJsonApiError(404, "Not Found", {
              code: "ROLE_NOT_FOUND",
              detail: `Role with id ${id} not found`,
            }),
          );
        }

        const ruleRepository = this.em.getRepository(PermissionRuleEntity);
        const existingRules = await ruleRepository.find({ role: role.id });
        this.em.remove(existingRules);

        const newRules = request.body.data.map((rule) =>
          ruleRepository.create({
            id: randomUUID(),
            role: role.id,
            action: rule.action,
            subject: rule.subject,
            conditions: rule.conditions ?? null,
            fields: rule.fields ?? null,
            inverted: rule.inverted ?? false,
            order: rule.order ?? 0,
          }),
        );

        await this.em.flush();

        return reply.send(jsonApiSerializeSingleRoleDocument(role, newRules));
      },
    );
  }
}
