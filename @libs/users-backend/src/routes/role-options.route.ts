import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { array, object } from "zod";
import type { EntityManager } from "@mikro-orm/core";
import {
  jsonApiSerializeManyRoles,
  RoleEntity,
  SerializedRoleSchema,
  requirePermission,
} from "@libs/permissions-backend";
import type { Route } from "@libs/backend-shared";

// Role choices needed by user create/edit forms. Guarded by manage:User so
// user managers do not need the stronger manage:Role permission.
export class RoleOptionsRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/role-options",
      {
        preHandler: [requirePermission("manage", "User")],
        schema: {
          response: {
            200: object({ data: array(SerializedRoleSchema) }),
          },
        },
      },
      async (_request, reply) => {
        const roles = await this.em.getRepository(RoleEntity).findAll({
          orderBy: { name: "ASC" },
        });

        return reply.send({ data: jsonApiSerializeManyRoles(roles) });
      },
    );
  }
}
