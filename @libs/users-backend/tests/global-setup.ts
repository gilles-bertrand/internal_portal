import { entities, UserEntity } from "#src/index.js";
import { entities as permissionsEntities, RoleEntity } from "@libs/permissions-backend";
import { MikroORM } from "@mikro-orm/postgresql";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { hash } from "argon2";
import { randomUUID } from "crypto";
import { TestModule } from "./utils/setup-module.js";

let container: StartedPostgreSqlContainer;

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .start();

  process.env.TEST_DATABASE_URL = container.getConnectionUri();

  const orm = await MikroORM.init({
    entities: [...entities, ...permissionsEntities],
    clientUrl: process.env.TEST_DATABASE_URL,
  });

  await orm.schema.refresh();

  const roleId = randomUUID();
  await orm.em.getRepository(RoleEntity).insert({ id: roleId, name: "encoder", description: null });

  const hashedPassword = await hash("testpassword");
  await orm.em.getRepository(UserEntity).insert({
    id: TestModule.TEST_USER_ID,
    email: "a@test.com",
    firstName: "Test",
    lastName: "User",
    password: hashedPassword,
    role: roleId,
  });

  await orm.close();
}

export async function teardown() {
  await container?.stop();
}
