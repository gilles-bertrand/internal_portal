import { entities as auditLogEntities } from "#src/index.js";
import { MikroORM } from "@mikro-orm/postgresql";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { APPEND_ONLY_DDL_TEST } from "#tests/utils/append-only-test.sql.js";

let container: StartedPostgreSqlContainer;

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .start();

  process.env.TEST_DATABASE_URL = container.getConnectionUri();

  const orm = await MikroORM.init({
    entities: [...auditLogEntities],
    clientUrl: process.env.TEST_DATABASE_URL,
  });

  await orm.schema.refresh();
  await orm.em.execute(APPEND_ONLY_DDL_TEST);

  await orm.close();
}

export async function teardown() {
  if (container) {
    await container.stop();
  }
}
