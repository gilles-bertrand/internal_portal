import { type AuthModule, type UserModule } from "@libs/users-backend";
import type { FastifyInstanceType } from "./app.js";
import { statusRoute } from "./status.route.js";
import { Module as TodoModule } from "@libs/todos-backend";
import { type Module as AccessRegistryModule } from "@libs/access-registry-backend";
import { type Module as IncidentRegistryModule } from "@libs/incident-registry-backend";
import { type PermissionsModule } from "@libs/permissions-backend";

// @lat: [[apps/backend-bootstrap#Assemblage incident-registry (module désormais branché)]]
interface AppRouterOptions {
  authModule: AuthModule;
  userModule: UserModule;
  todosModule: TodoModule;
  accessRegistryModule: AccessRegistryModule;
  incidentRegistryModule: IncidentRegistryModule;
  permissionsModule: PermissionsModule;
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
  }: AppRouterOptions,
) {
  await fastify.register(
    async function (fastify) {
      await fastify.register(statusRoute);
      await authModule.setupRoutes(fastify);
      await fastify.register(async (fastify) => {
        // Resource routes
        fastify.addHook("onRoute", (routeOptions) => {
          if (routeOptions.schema) {
            routeOptions.schema.tags ??= ["resource"];
          }
        });
      });

      await userModule.setupRoutes(fastify);
      await todosModule.setupRoutes(fastify);
      await accessRegistryModule.setupRoutes(fastify);
      await incidentRegistryModule.setupRoutes(fastify);
      await permissionsModule.setupRoutes(fastify);
    },
    {
      prefix: "api/v1",
    },
  );
}
