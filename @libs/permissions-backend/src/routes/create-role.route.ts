import type { EntityManager } from "@mikro-orm/postgresql";
import { object, string } from "zod";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import { randomUUID } from "crypto";
import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { RoleEntity } from "#src/entities/role.entity.js";
import {
  jsonApiSerializeSingleRoleDocument,
  SerializedRoleSchema,
} from "#src/serializers/role.serializer.js";

export class CreateRoleRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/",
      {
        schema: {
          body: makeSingleJsonApiTopDocument(
            object({
              id: string().optional().nullable(),
              attributes: object({
                name: string().min(1, "Le nom du rôle est requis"),
                description: string().optional().nullable(),
              }),
            }),
          ),
          response: {
            200: object({ data: SerializedRoleSchema }),
            409: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const body = request.body.data.attributes;
        const repository = this.em.getRepository(RoleEntity);

        const existing = await repository.findOne({ name: body.name });
        if (existing) {
          return reply.code(409).send(
            makeJsonApiError(409, "Conflict", {
              code: "ROLE_NAME_TAKEN",
              detail: `Un rôle nommé "${body.name}" existe déjà`,
            }),
          );
        }

        const role = repository.create({
          id: request.body.data.id || randomUUID(),
          name: body.name,
          description: body.description ?? null,
        });

        await this.em.flush();

        return reply.send(jsonApiSerializeSingleRoleDocument(role));
      },
    );
  }
}
