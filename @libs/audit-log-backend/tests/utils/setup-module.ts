import { entities as auditLogEntities } from "#src/index.js";
import { AuditAppendService } from "#src/utils/audit-append.service.js";
import { MikroORM } from "@mikro-orm/postgresql";
import type { EntityManager } from "@mikro-orm/postgresql";

export class TestModule {
  private constructor(
    public service: AuditAppendService,
    public em: EntityManager,
    private orm: MikroORM,
  ) {}

  public static async init() {
    const connectionUrl = process.env.TEST_DATABASE_URL;
    if (!connectionUrl) {
      throw new Error("TEST_DATABASE_URL not set — global-setup.ts must run first.");
    }

    const orm = await MikroORM.init({
      entities: [...auditLogEntities],
      clientUrl: connectionUrl,
    });

    const em = orm.em.fork();
    const service = new AuditAppendService(em);

    return new TestModule(service, em, orm);
  }

  public async close() {
    await this.orm.close(true);
  }
}
