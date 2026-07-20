import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { array, literal, object, string } from "zod";
import { type Route } from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { UserEntity } from "@libs/users-backend";
import { PermissionRuleEntity, requirePermission } from "@libs/permissions-backend";
import { userNameFor } from "#src/utils/user-display.js";

export const SerializedEligibleAccessorSchema = object({
  id: string(),
  type: literal("eligible-accessors"),
  attributes: object({ name: string() }),
});

// Liste des utilisateurs habilités à enregistrer un access-record, destinée à
// peupler la select `accessorRef` du formulaire de création. `GET /users` étant
// gardé `manage:User`, un encodeur ne peut pas l'appeler — d'où cet endpoint
// dédié, gardé `create:AccessRecord`, qui ne renvoie que id + nom d'affichage.
//
// La résolution par règles CASL est une approximation suffisante pour une liste
// de suggestions : l'autorisation réelle reste appliquée par `requirePermission`
// sur `POST /access-records`.
export class EligibleAccessorsRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/eligible-accessors",
      {
        preHandler: [requirePermission("create", "AccessRecord")],
        schema: {
          response: { 200: object({ data: array(SerializedEligibleAccessorSchema) }) },
        },
      },
      async (_request, reply) => {
        const ruleRepo = this.em.getRepository(PermissionRuleEntity);

        // Rôles dont une règle non-inversée autorise create/manage sur AccessRecord (ou `all`).
        const grantingRules = await ruleRepo.find(
          {
            subject: { $in: ["AccessRecord", "all"] },
            action: { $in: ["create", "manage"] },
            inverted: false,
          },
          { populate: ["role"] },
        );
        const eligibleRoleIds = new Set(grantingRules.map((rule) => rule.role.id));

        // Retirer les rôles portant un `cannot manage AccessRecord` (ex. tech_admin).
        const denyingRules = await ruleRepo.find(
          {
            subject: { $in: ["AccessRecord", "all"] },
            action: "manage",
            inverted: true,
          },
          { populate: ["role"] },
        );
        for (const rule of denyingRules) {
          eligibleRoleIds.delete(rule.role.id);
        }

        if (eligibleRoleIds.size === 0) {
          return reply.send({ data: [] });
        }

        const users = await this.em
          .getRepository(UserEntity)
          .find(
            { role: { $in: [...eligibleRoleIds] } },
            { populate: ["role"], orderBy: { firstName: "ASC", lastName: "ASC" } },
          );

        return reply.send({
          data: users.map((user) => ({
            id: user.id,
            type: "eligible-accessors" as const,
            attributes: { name: userNameFor(user, user.id) },
          })),
        });
      },
    );
  }
}
