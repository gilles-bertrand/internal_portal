import type { EntityManager } from "@mikro-orm/postgresql";
import { array, object } from "zod";
import { type Route } from "@libs/backend-shared";
import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { RoleEntity } from "#src/entities/role.entity.js";
import {
  jsonApiSerializeManyRoles,
  SerializedRoleSchema,
} from "#src/serializers/role.serializer.js";

export class ListRolesRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/",
      { schema: { response: { 200: object({ data: array(SerializedRoleSchema) }) } } },
      async (_request, reply) => {
        const roles = await this.em.getRepository(RoleEntity).findAll({ orderBy: { name: "ASC" } });
        return reply.send({ data: jsonApiSerializeManyRoles(roles) });
      },
    );
  }
}
