import { entities } from "#src/index.js";
import { FakeUserEntity } from "#tests/utils/fake-user.entity.js";
import { MikroORM } from "@mikro-orm/postgresql";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

let container: StartedPostgreSqlContainer;

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .start();

  process.env.TEST_DATABASE_URL = container.getConnectionUri();

  const orm = await MikroORM.init({
    entities: [...entities, FakeUserEntity],
    clientUrl: process.env.TEST_DATABASE_URL,
  });

  await orm.schema.refresh();
  await orm.close();
}

export async function teardown() {
  if (container) {
    await container.stop();
  }
}
