import {
  entities as incidentRegistryEntities,
  Module,
  type FastifyInstanceTypeForModule,
} from "#src/index.js";
import { entities as userEntities, UserEntity } from "@libs/users-backend";
import { entities as auditLogEntities, AuditAppendService } from "@libs/audit-log-backend";
import { MikroORM } from "@mikro-orm/postgresql";
import { fastify } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { sign } from "jsonwebtoken";
import type { EntityManager } from "@mikro-orm/postgresql";

export class TestModule {
  public static JWT_SECRET = "testSecret";
  public static EXPORT_SIGNING_KEY = "testExportKey32bytesLongEnough!!";

  declare public fastifyInstance: FastifyInstanceTypeForModule;

  private constructor(
    public module: Module,
    private orm: MikroORM,
  ) {}

  public static async init() {
    const connectionUrl = process.env.TEST_DATABASE_URL;
    if (!connectionUrl) {
      throw new Error("TEST_DATABASE_URL not set — global-setup.ts must run first.");
    }

    const orm = await MikroORM.init({
      entities: [...incidentRegistryEntities, ...auditLogEntities, ...userEntities],
      clientUrl: connectionUrl,
    });

    const fastifyInstance = fastify().withTypeProvider<ZodTypeProvider>();
    fastifyInstance.setValidatorCompiler(validatorCompiler);
    fastifyInstance.setSerializerCompiler(serializerCompiler);

    const auditLogger = new AuditAppendService(orm.em.fork());

    const module = Module.init(
      {
        em: orm.em.fork(),
        configuration: {
          jwtSecret: TestModule.JWT_SECRET,
          exportSigningKey: TestModule.EXPORT_SIGNING_KEY,
        },
      },
      auditLogger,
    );

    fastifyInstance.setErrorHandler((error: unknown, _req, reply) => {
      console.error(
        "[TestModule] route error:",
        (error as Error).message,
        (error as Error).stack?.split("\n").slice(0, 5).join("\n"),
      );
      void reply.status(500).send({ message: (error as Error).message });
    });

    const testModule = new TestModule(module, orm);
    testModule.fastifyInstance = fastifyInstance;

    await module.setupRoutes(fastifyInstance);

    return testModule;
  }

  get em(): EntityManager {
    return (this.module as unknown as { context: { em: EntityManager } }).context.em;
  }

  public generateBearerToken(userId: string, role: string = "encoder") {
    return "Bearer " + sign({ userId, role }, TestModule.JWT_SECRET);
  }

  public async insertUser(id: string, role: string, em = this.em) {
    const hashedPassword =
      "$argon2id$v=19$m=65536,t=3,p=4$ETHkx8pEQN6qQwlIR+vUTQ$+QC4JBKJCQUL1dyCHzRMBNjbk+QaJi3PV+HkPY00kcc";
    await em.getRepository(UserEntity).insert({
      id,
      email: `${id}@test.com`,
      firstName: "Test",
      lastName: "User",
      password: hashedPassword,
      role,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: null,
    });
  }

  public async close() {
    await this.orm.close(true);
  }
}
