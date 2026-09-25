import { entities as incidentRegistryEntities } from "#src/index.js";
import { entities as userEntities, UserEntity } from "@libs/users-backend";
import {
  entities as permissionsEntities,
  RoleEntity,
  PermissionRuleEntity,
} from "@libs/permissions-backend";
import { entities as auditLogEntities } from "@libs/audit-log-backend";
import { MikroORM } from "@mikro-orm/postgresql";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { APPEND_ONLY_DDL_TEST } from "#tests/utils/append-only-test.sql.js";
// @lat: [[backend/permissions#Seed des 4 rôles avec permissions équivalentes au comportement actuel]]
import { PERMISSION_RULE_SEED } from "#tests/utils/permission-rule-seed.js";

let container: StartedPostgreSqlContainer;

const ROLE_NAMES = ["encoder", "dpo", "auditor", "tech_admin"] as const;

function roleIdFor(name: string) {
  return `role-${name}`;
}

async function seedPermissionRules(orm: MikroORM) {
  await (
    orm.em.getRepository(PermissionRuleEntity).insert as unknown as (data: unknown) => Promise<void>
  )(
    PERMISSION_RULE_SEED.map((rule, index) => ({
      id: `perm-rule-${index}`,
      role: roleIdFor(rule.role),
      action: rule.action,
      subject: rule.subject,
      conditions: rule.conditions ?? null,
      fields: null,
      inverted: rule.inverted ?? false,
      order: rule.order ?? 0,
    })),
  );
}

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .start();

  process.env.TEST_DATABASE_URL = container.getConnectionUri();

  const orm = await MikroORM.init({
    entities: [
      ...incidentRegistryEntities,
      ...auditLogEntities,
      ...userEntities,
      ...permissionsEntities,
    ],
    clientUrl: process.env.TEST_DATABASE_URL,
  });

  await orm.schema.refresh();
  await orm.em.execute(APPEND_ONLY_DDL_TEST);

  await (orm.em.getRepository(RoleEntity).insert as unknown as (data: unknown) => Promise<void>)(
    ROLE_NAMES.map((name) => ({ id: roleIdFor(name), name, description: null })),
  );
  await seedPermissionRules(orm);

  const hashedPassword =
    "$argon2id$v=19$m=65536,t=3,p=4$ETHkx8pEQN6qQwlIR+vUTQ$+QC4JBKJCQUL1dyCHzRMBNjbk+QaJi3PV+HkPY00kcc";

  await (orm.em.getRepository(UserEntity).insert as unknown as (data: unknown) => Promise<void>)([
    {
      id: "encoder-id",
      email: "encoder@test.com",
      firstName: "E",
      lastName: "N",
      password: hashedPassword,
      role: roleIdFor("encoder"),
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
      role: roleIdFor("dpo"),
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
      role: roleIdFor("auditor"),
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
      role: roleIdFor("tech_admin"),
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
