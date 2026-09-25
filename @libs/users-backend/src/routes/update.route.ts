import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { wrap, type EntityRepository } from "@mikro-orm/core";
import { object, string } from "zod";
import {
  jsonApiSerializeSingleUserDocument,
  SerializedUserSchema,
} from "#src/serializers/user.serializer.js";
import type { UserEntityType } from "#src/entities/user.entity.js";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import { requirePermission, RoleEntity } from "@libs/permissions-backend";

const updateUserAttributesSchema = object({
  email: string().optional(),
  firstName: string().optional(),
  lastName: string().optional(),
  roleId: string().optional(),
});

// @lat: [[backend/permissions#Édition d'utilisateur guardée par manage:User]]
export class UpdateRoute implements Route {
  public constructor(private userRepository: EntityRepository<UserEntityType>) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.patch(
      "/:id",
      {
        preHandler: [requirePermission("manage", "User")],
        schema: {
          params: object({
            id: string(),
          }),
          body: makeSingleJsonApiTopDocument(object({ attributes: updateUserAttributesSchema })),
          response: {
            200: makeSingleJsonApiTopDocument(SerializedUserSchema),
            400: jsonApiErrorDocumentSchema,
            403: jsonApiErrorDocumentSchema,
            404: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const { roleId, ...attributes } = request.body.data.attributes;
        const em = this.userRepository.getEntityManager();

        const user = await this.userRepository.findOne({ id }, { populate: ["role"] });

        if (!user) {
          return reply.code(404).send(
            makeJsonApiError(404, "Not Found", {
              code: "USER_NOT_FOUND",
              detail: `User with id ${id} not found`,
            }),
          );
        }

        if (roleId) {
          const role = await em.getRepository(RoleEntity).findOne({ id: roleId });
          if (!role) {
            return reply.code(400).send(
              makeJsonApiError(400, "Bad Request", {
                code: "ROLE_NOT_FOUND",
                detail: `Role with id ${roleId} not found`,
              }),
            );
          }
          user.role = role;
        }

        wrap(user).assign(attributes);

        await em.flush();

        return reply.send(jsonApiSerializeSingleUserDocument(user));
      },
    );
  }
}
