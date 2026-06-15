import type {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { LibraryContext } from "./context.js";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { CreateRoute } from "#src/routes/create.route.js";
import { ListRoute } from "#src/routes/list.route.js";
import { GetRoute } from "#src/routes/get.route.js";
import { VerifyIntegrityRoute } from "#src/routes/verify-integrity.route.js";
import { StatsRoute } from "#src/routes/stats.route.js";
import { AccessRecordEntity } from "./entities/access-record.entity.js";
import { handleJsonApiErrors, makeJsonApiError, type ModuleInterface, type Route } from "@libs/backend-shared";
import { createJwtAuthMiddleware } from "@libs/users-backend";
import type { AuditLogger } from "#src/utils/audit-logger.type.js";

export type FastifyInstanceTypeForModule = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export class Module implements ModuleInterface<FastifyInstanceTypeForModule> {
  private constructor(
    private context: LibraryContext,
    private auditLogger: AuditLogger,
  ) {}

  public static init(context: LibraryContext, auditLogger: AuditLogger): Module {
    return new Module(context, auditLogger);
  }

  public async setupRoutes(fastify: FastifyInstanceTypeForModule): Promise<void> {
    const repository = this.context.em.getRepository(AccessRecordEntity);

    await fastify.register(
      async (f) => {
        f.setErrorHandler((error, request, reply) => {
          handleJsonApiErrors(error, request, reply);
        });

        const jwtAuth = createJwtAuthMiddleware(
          this.context.em,
          this.context.configuration.jwtSecret,
        );
        f.addHook("preValidation", jwtAuth);

        // tech_admin est interdit sur tout le registre (séparation des rôles)
        f.addHook("preHandler", async (request, reply) => {
          if (request.user?.role === "tech_admin") {
            return reply
              .code(403)
              .send(
                makeJsonApiError(403, "Forbidden", {
                  code: "FORBIDDEN",
                  detail: "tech_admin n'a pas accès au contenu du registre",
                }),
              );
          }
        });

        const routes: Route<FastifyInstanceTypeForModule>[] = [
          new CreateRoute(this.context.em, this.auditLogger),
          new ListRoute(this.context.em, this.auditLogger),
          new GetRoute(repository, this.auditLogger),
          new VerifyIntegrityRoute(this.context.em),
          new StatsRoute(this.context.em),
        ];

        for (const route of routes) {
          route.routeDefinition(f);
        }
      },
      { prefix: "/access-records" },
    );
  }
}

