import type { EntityManager } from "@mikro-orm/postgresql";
import { wrap } from "@mikro-orm/core";
import { object, string } from "zod";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { RoleEntity } from "#src/entities/role.entity.js";
import {
  jsonApiSerializeSingleRoleDocument,
  SerializedRoleSchema,
} from "#src/serializers/role.serializer.js";

export class UpdateRoleRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.patch(
      "/:id",
      {
        schema: {
          params: object({ id: string() }),
          body: makeSingleJsonApiTopDocument(
            object({
              attributes: object({
                name: string().min(1).optional(),
                description: string().optional().nullable(),
              }),
            }),
          ),
          response: {
            200: object({ data: SerializedRoleSchema }),
            404: jsonApiErrorDocumentSchema,
            409: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const { id } = request.params;
        const repository = this.em.getRepository(RoleEntity);
        const role = await repository.findOne({ id });

        if (!role) {
          return reply.code(404).send(
            makeJsonApiError(404, "Not Found", {
              code: "ROLE_NOT_FOUND",
              detail: `Role with id ${id} not found`,
            }),
          );
        }

        const body = request.body.data.attributes;

        if (body.name && body.name !== role.name) {
          const existing = await repository.findOne({ name: body.name });
          if (existing) {
            return reply.code(409).send(
              makeJsonApiError(409, "Conflict", {
                code: "ROLE_NAME_TAKEN",
                detail: `Un rôle nommé "${body.name}" existe déjà`,
              }),
            );
          }
        }

        wrap(role).assign(body);
        await this.em.flush();

        return reply.send(jsonApiSerializeSingleRoleDocument(role));
      },
    );
  }
}
