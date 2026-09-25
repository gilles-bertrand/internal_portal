import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { type UserEntityType } from "#src/entities/user.entity.js";
import type { EntityRepository } from "@mikro-orm/core";
import { randomUUID } from "crypto";
import {
  jsonApiSerializeSingleUserDocument,
  SerializedUserSchema,
} from "#src/serializers/user.serializer.js";
import { hash } from "argon2";
import { email, object, string } from "zod";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import { requirePermission, RoleEntity } from "@libs/permissions-backend";

// @lat: [[backend/permissions#Création d'utilisateur guardée par manage:User]]
export class CreateRoute implements Route {
  public constructor(private userRepository: EntityRepository<UserEntityType>) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/",
      {
        preHandler: [requirePermission("manage", "User")],
        schema: {
          body: makeSingleJsonApiTopDocument(
            object({
              id: string().optional().nullable(),
              attributes: object({
                email: email(),
                firstName: string(),
                lastName: string(),
                password: string().min(12, "Le mot de passe doit contenir au moins 12 caractères"),
                roleId: string("Le rôle est requis"),
              }),
            }),
          ),
          response: {
            200: makeSingleJsonApiTopDocument(SerializedUserSchema),
            400: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const body = request.body.data.attributes;
        const em = this.userRepository.getEntityManager();

        const role = await em.getRepository(RoleEntity).findOne({ id: body.roleId });
        if (!role) {
          return reply.code(400).send(
            makeJsonApiError(400, "Bad Request", {
              code: "ROLE_NOT_FOUND",
              detail: `Role with id ${body.roleId} not found`,
            }),
          );
        }

        const password = await hash(body.password);

        const user = this.userRepository.create({
          id: request.body.data.id || randomUUID(),
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          password,
          role,
          passwordChangedAt: new Date().toISOString(),
        });

        await em.flush();

        return reply.send(jsonApiSerializeSingleUserDocument(user));
      },
    );
  }
}
