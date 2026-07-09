import { entities, PermissionsModule, type FastifyInstanceTypeForModule } from "#src/index.js";
import { FakeUserEntity } from "#tests/utils/fake-user.entity.js";
import { MikroORM } from "@mikro-orm/postgresql";
import { fastify } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { EntityManager } from "@mikro-orm/postgresql";
import { createMongoAbility, type RawRuleOf } from "@casl/ability";
import type { AppAbility } from "#src/ability/ability-builder.js";

/**
 * Harnais de test isolé de tout module d'authentification réel : l'ability
 * attachée à chaque requête est dérivée d'un header `x-test-rules` (JSON),
 * pas d'un vrai JWT — permissions-backend reste ainsi testable sans
 * dépendre de users-backend, conformément à son objectif de portabilité.
 */
export class TestModule {
  declare public fastifyInstance: FastifyInstanceTypeForModule;

  private constructor(
    private orm: MikroORM,
    private sharedEm: EntityManager,
  ) {}

  public static async init() {
    const connectionUrl = process.env.TEST_DATABASE_URL;
    if (!connectionUrl) {
      throw new Error("TEST_DATABASE_URL not set — global-setup.ts must run first.");
    }

    const orm = await MikroORM.init({
      entities: [...entities, FakeUserEntity],
      clientUrl: connectionUrl,
    });

    const fastifyInstance = fastify().withTypeProvider<ZodTypeProvider>();
    fastifyInstance.setValidatorCompiler(validatorCompiler);
    fastifyInstance.setSerializerCompiler(serializerCompiler);

    const sharedEm = orm.em.fork();

    const permissionsModule = PermissionsModule.init({ em: sharedEm }, async (request) => {
      const header = request.headers["x-test-rules"];
      const rules = header ? (JSON.parse(header as string) as RawRuleOf<AppAbility>[]) : [];
      request.ability = createMongoAbility<AppAbility>(rules);
    });

    const testModule = new TestModule(orm, sharedEm);
    testModule.fastifyInstance = fastifyInstance;

    await permissionsModule.setupRoutes(fastifyInstance);

    return testModule;
  }

  get em(): EntityManager {
    return this.sharedEm;
  }

  public rulesHeader(rules: RawRuleOf<AppAbility>[]): Record<string, string> {
    return { "x-test-rules": JSON.stringify(rules) };
  }

  public async close() {
    await this.orm.close(true);
  }
}
