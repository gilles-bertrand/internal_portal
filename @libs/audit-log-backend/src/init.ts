import type {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { EntityManager } from "@mikro-orm/postgresql";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { handleJsonApiErrors, type ModuleInterface, type Route } from "@libs/backend-shared";
import { createJwtAuthMiddleware } from "@libs/users-backend";
import { AuditEventsRoute } from "#src/routes/audit-events.route.js";

export type FastifyInstanceTypeForModule = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface AuditLogModuleContext {
  em: EntityManager;
  configuration: { jwtSecret: string };
}

// Le noyau d'audit gagne une surface HTTP — en lecture seule.
//
// Cela amende la décision « audit-log est un noyau sans HTTP », sans en casser
// la raison d'être. Ce qui était voulu, et reste vrai : les registres n'importent
// pas ce paquet pour leur logique métier, ils écrivent à travers une interface
// `AuditLogger` locale dont seul `app.ts` connaît l'implémentation concrète. Le
// découplage porte sur l'ÉCRITURE, et il est intact.
//
// Ce qui change : la LECTURE du journal était logée dans le registre d'accès,
// alors qu'elle interroge la table globale. Deux conséquences qui ont motivé le
// déplacement — le journal de tous les domaines devenait indisponible dès que ce
// registre n'était pas monté, et son garde `read AccessRecord` laissait
// `tech_admin` observer l'activité d'incidents dont il est explicitement banni.
//
// Ce module n'est PAS pilotable par drapeau : la traçabilité d'un registre de
// conformité ne se démonte pas.
//
// @lat: [[backend/audit-log#Journal exposé par son propre module]]
export class Module implements ModuleInterface<FastifyInstanceTypeForModule> {
  private constructor(private context: AuditLogModuleContext) {}

  public static init(context: AuditLogModuleContext): Module {
    return new Module(context);
  }

  public async setupRoutes(fastify: FastifyInstanceTypeForModule): Promise<void> {
    await fastify.register(async (f) => {
      const routes: Route<FastifyInstanceTypeForModule>[] = [new AuditEventsRoute(this.context.em)];

      f.setErrorHandler((error, request, reply) => {
        handleJsonApiErrors(error, request, reply);
      });

      f.addHook(
        "preValidation",
        createJwtAuthMiddleware(this.context.em, this.context.configuration.jwtSecret),
      );

      for (const route of routes) {
        route.routeDefinition(f);
      }
    });
  }
}
