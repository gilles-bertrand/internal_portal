import type { EntityManager } from "@mikro-orm/postgresql";
import { ForeignKeyConstraintViolationException } from "@mikro-orm/core";
import { literal, object, string } from "zod";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { RoleEntity } from "#src/entities/role.entity.js";
import { PermissionRuleEntity } from "#src/entities/permission-rule.entity.js";

// @lat: [[backend/permissions#Suppression d'un rôle encore assigné]]
export class DeleteRoleRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.delete(
      "/:id",
      {
        schema: {
          params: object({ id: string() }),
          response: {
            404: jsonApiErrorDocumentSchema,
            409: jsonApiErrorDocumentSchema,
            204: makeSingleJsonApiTopDocument(literal(null)),
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

        try {
          const rules = await this.em.getRepository(PermissionRuleEntity).find({ role: role.id });
          this.em.remove(rules);
          this.em.remove(role);
          await this.em.flush();
        } catch (error) {
          // Un utilisateur référence encore ce rôle : la contrainte FK sur user.role_id l'empêche.
          if (error instanceof ForeignKeyConstraintViolationException) {
            return reply.code(409).send(
              makeJsonApiError(409, "Conflict", {
                code: "ROLE_IN_USE",
                detail: "Ce rôle est encore assigné à un ou plusieurs utilisateurs",
              }),
            );
          }
          throw error;
        }

        return reply.code(204).send({ data: null });
      },
    );
  }
}
