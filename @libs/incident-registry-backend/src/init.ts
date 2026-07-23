import type {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import "#src/types.js";
import type { LibraryContext } from "./context.js";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { CreateRoute } from "#src/routes/create.route.js";
import { ListRoute } from "#src/routes/list.route.js";
import { GetRoute } from "#src/routes/get.route.js";
import { UpdateRoute } from "#src/routes/update.route.js";
import { DeleteRoute } from "#src/routes/delete.route.js";
import { RestoreRoute } from "#src/routes/restore.route.js";
import { VerifyIntegrityRoute } from "#src/routes/verify-integrity.route.js";
import { ExportRoute } from "#src/routes/export.route.js";
import { ExportOneRoute } from "#src/routes/export-one.route.js";
import { IncidentEntity } from "./entities/incident.entity.js";
import {
  handleJsonApiErrors,
  makeJsonApiError,
  type ModuleInterface,
  type Route,
} from "@libs/backend-shared";
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
    const repository = this.context.em.getRepository(IncidentEntity);

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

        // tech_admin porte une règle CASL explicite cannot("manage", "Incident") — les
        // routes du groupe demandent des actions différentes (create/read selon le rôle),
        // donc ce guard ne peut pas être un requirePermission générique (même pattern
        // que access-registry-backend/src/init.ts).
        f.addHook("preHandler", async (request, reply) => {
          const forbidden = request.ability
            ?.rulesFor("manage", "Incident")
            .some((rule) => rule.inverted);
          if (forbidden) {
            return reply.code(403).send(
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
          new UpdateRoute(this.context.em, this.auditLogger),
          new DeleteRoute(this.context.em, this.auditLogger),
          new RestoreRoute(this.context.em, this.auditLogger),
          new VerifyIntegrityRoute(this.context.em),
          new ExportRoute(
            this.context.em,
            this.context.configuration.exportSigningKey,
            this.auditLogger,
          ),
          new ExportOneRoute(
            this.context.em,
            this.context.configuration.exportSigningKey,
            this.auditLogger,
          ),
        ];

        for (const route of routes) {
          route.routeDefinition(f);
        }
      },
      { prefix: "/incidents" },
    );
  }
}
