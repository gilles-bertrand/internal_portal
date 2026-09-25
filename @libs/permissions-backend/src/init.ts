import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { LibraryContext } from "#src/context.js";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { ListRolesRoute } from "#src/routes/list-roles.route.js";
import { GetRoleRoute } from "#src/routes/get-role.route.js";
import { CreateRoleRoute } from "#src/routes/create-role.route.js";
import { UpdateRoleRoute } from "#src/routes/update-role.route.js";
import { UpdateRoleRulesRoute } from "#src/routes/update-role-rules.route.js";
import { DeleteRoleRoute } from "#src/routes/delete-role.route.js";
import { GetMyAbilityRoute } from "#src/routes/get-my-ability.route.js";
import { requirePermission } from "#src/middlewares/require-permission.middleware.js";
import { handleJsonApiErrors, type ModuleInterface, type Route } from "@libs/backend-shared";

export type FastifyInstanceTypeForModule = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export type AuthHook = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

// @lat: [[backend/permissions#Module Fastify PermissionsModule]]
export class PermissionsModule implements ModuleInterface<FastifyInstanceTypeForModule> {
  private constructor(
    private context: LibraryContext,
    private authHook: AuthHook,
  ) {}

  /**
   * `authHook` est injecté par la racine de composition (pas importé depuis
   * users-backend) pour que ce module reste indépendant de toute librairie
   * d'authentification spécifique — condition de sa portabilité future.
   */
  public static init(context: LibraryContext, authHook: AuthHook): PermissionsModule {
    return new PermissionsModule(context, authHook);
  }

  public async setupRoutes(fastify: FastifyInstanceTypeForModule): Promise<void> {
    await fastify.register(
      async (f) => {
        f.setErrorHandler((error, request, reply) => {
          handleJsonApiErrors(error, request, reply);
        });

        f.addHook("preValidation", this.authHook);
        f.addHook("preHandler", requirePermission("manage", "Role"));

        const routes: Route<FastifyInstanceTypeForModule>[] = [
          new ListRolesRoute(this.context.em),
          new GetRoleRoute(this.context.em),
          new CreateRoleRoute(this.context.em),
          new UpdateRoleRoute(this.context.em),
          new UpdateRoleRulesRoute(this.context.em),
          new DeleteRoleRoute(this.context.em),
        ];

        for (const route of routes) {
          route.routeDefinition(f);
        }
      },
      { prefix: "/roles" },
    );

    // Accessible à tout utilisateur authentifié (chacun a le droit de
    // connaître ses propres permissions) — pas de requirePermission ici,
    // contrairement au bloc /roles ci-dessus.
    await fastify.register(
      async (f) => {
        f.setErrorHandler((error, request, reply) => {
          handleJsonApiErrors(error, request, reply);
        });

        f.addHook("preValidation", this.authHook);

        new GetMyAbilityRoute().routeDefinition(f);
      },
      { prefix: "/me" },
    );
  }
}
