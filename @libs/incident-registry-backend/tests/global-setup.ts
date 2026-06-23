import { entities as incidentRegistryEntities } from "#src/index.js";
import { entities as userEntities, UserEntity } from "@libs/users-backend";
import { entities as auditLogEntities } from "@libs/audit-log-backend";
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
    entities: [...incidentRegistryEntities, ...auditLogEntities, ...userEntities],
    clientUrl: process.env.TEST_DATABASE_URL,
  });

  await orm.schema.refresh();
  await orm.em.execute(APPEND_ONLY_DDL_TEST);

  const hashedPassword =
    "$argon2id$v=19$m=65536,t=3,p=4$ETHkx8pEQN6qQwlIR+vUTQ$+QC4JBKJCQUL1dyCHzRMBNjbk+QaJi3PV+HkPY00kcc";

  await (orm.em.getRepository(UserEntity).insert as unknown as (data: unknown) => Promise<void>)([
    {
      id: "encoder-id",
      email: "encoder@test.com",
      firstName: "E",
      lastName: "N",
      password: hashedPassword,
      role: "encoder",
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: null,
    },
    {
      id: "dpo-id",
      email: "dpo@test.com",
      firstName: "D",
      lastName: "P",
      password: hashedPassword,
      role: "dpo",
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: null,
    },
    {
      id: "auditor-id",
      email: "auditor@test.com",
      firstName: "A",
      lastName: "U",
      password: hashedPassword,
      role: "auditor",
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: null,
    },
    {
      id: "admin-id",
      email: "admin@test.com",
      firstName: "A",
      lastName: "D",
      password: hashedPassword,
      role: "tech_admin",
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: null,
    },
  ]);

  await orm.close();
}

export async function teardown() {
  if (container) {
    await container.stop();
  }
}
