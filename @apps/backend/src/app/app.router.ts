import { type AuthModule, type UserModule } from "@libs/users-backend";
import type { FastifyInstanceType } from "./app.js";
import { statusRoute } from "./status.route.js";
import { Module as TodoModule } from "@libs/todos-backend";
import { type Module as AccessRegistryModule } from "@libs/access-registry-backend";
import { type Module as IncidentRegistryModule } from "@libs/incident-registry-backend";
import { type PermissionsModule } from "@libs/permissions-backend";
import { type AuditLogModule } from "@libs/audit-log-backend";
import type { FeatureName } from "#src/configuration.js";

// @lat: [[apps/backend-bootstrap#Assemblage incident-registry (module désormais branché)]]
interface AppRouterOptions {
  authModule: AuthModule;
  userModule: UserModule;
  todosModule: TodoModule;
  accessRegistryModule: AccessRegistryModule;
  incidentRegistryModule: IncidentRegistryModule;
  permissionsModule: PermissionsModule;
  // Journal d'audit : transverse, jamais pilotable par drapeau. La traçabilité
  // d'un registre de conformité ne se démonte pas, et elle couvre des domaines
  // qui, eux, peuvent l'être.
  auditLogModule: AuditLogModule;
  // Domaines effectivement montés. Un domaine absent de cette table n'a AUCUNE
  // route : l'API ne l'expose pas, et le front l'apprend par `GET /status`.
  // Les entités et le schéma restent enregistrés (voir database.connection.ts) :
  // on retire une surface HTTP, jamais des données.
  // @lat: [[apps/backend-bootstrap#Drapeaux de fonctionnalité par domaine]]
  features: Record<FeatureName, boolean>;
}

export async function appRouter(
  fastify: FastifyInstanceType,
  {
    authModule,
    userModule,
    todosModule,
    accessRegistryModule,
    incidentRegistryModule,
    permissionsModule,
    auditLogModule,
    features,
  }: AppRouterOptions,
) {
  await fastify.register(
    async function (fastify) {
      await fastify.register(async (f) => statusRoute(f, { features }));
      await authModule.setupRoutes(fastify);
      await fastify.register(async (fastify) => {
        // Resource routes
        fastify.addHook("onRoute", (routeOptions) => {
          if (routeOptions.schema) {
            routeOptions.schema.tags ??= ["resource"];
          }
        });
      });

      // `users` et `permissions` ne sont pas pilotables : sans eux personne ne
      // se connecte ni n'administre les droits. Un drapeau dessus rendrait le
      // produit indémarrable, pas configurable.
      await userModule.setupRoutes(fastify);
      await permissionsModule.setupRoutes(fastify);
      await auditLogModule.setupRoutes(fastify);

      if (features.todos) {
        await todosModule.setupRoutes(fastify);
      }
      if (features.accessRegistry) {
        await accessRegistryModule.setupRoutes(fastify);
      }
      if (features.incidentRegistry) {
        await incidentRegistryModule.setupRoutes(fastify);
      }
    },
    {
      prefix: "api/v1",
    },
  );
}
