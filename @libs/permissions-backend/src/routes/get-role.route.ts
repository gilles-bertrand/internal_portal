import type { EntityManager } from "@mikro-orm/postgresql";
import { object, string } from "zod";
import { jsonApiErrorDocumentSchema, makeJsonApiError, type Route } from "@libs/backend-shared";
import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { RoleEntity } from "#src/entities/role.entity.js";
import { PermissionRuleEntity } from "#src/entities/permission-rule.entity.js";
import {
  jsonApiSerializeSingleRoleDocument,
  SerializedRoleSchema,
} from "#src/serializers/role.serializer.js";

export class GetRoleRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/:id",
      {
        schema: {
          params: object({ id: string() }),
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

        const rules = await this.em
          .getRepository(PermissionRuleEntity)
          .find({ role: role.id }, { orderBy: { order: "ASC" } });

        return reply.send(jsonApiSerializeSingleRoleDocument(role, rules));
      },
    );
  }
}
