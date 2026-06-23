import {
  entities as accessRegistryEntities,
  DataCategoryEntity,
  PurposeEntity,
  LegalBasisEntity,
} from "#src/index.js";
import { entities as userEntities, UserEntity } from "@libs/users-backend";
import { entities as auditLogEntities } from "@libs/audit-log-backend";
import { MikroORM } from "@mikro-orm/postgresql";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { APPEND_ONLY_DDL_TEST } from "#tests/utils/append-only-test.sql.js";

let container: StartedPostgreSqlContainer;

const HASHED_PASSWORD =
  "$argon2id$v=19$m=65536,t=3,p=4$ETHkx8pEQN6qQwlIR+vUTQ$+QC4JBKJCQUL1dyCHzRMBNjbk+QaJi3PV+HkPY00kcc";

function userSeed(id: string, email: string, firstName: string, lastName: string, role: string) {
  return {
    id,
    email,
    firstName,
    lastName,
    password: HASHED_PASSWORD,
    role,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: null,
  };
}

async function seedUsers(orm: MikroORM) {
  await (orm.em.getRepository(UserEntity).insert as unknown as (data: unknown) => Promise<void>)([
    userSeed("encoder-id", "encoder@test.com", "E", "N", "encoder"),
    userSeed("dpo-id", "dpo@test.com", "D", "P", "dpo"),
    userSeed("auditor-id", "auditor@test.com", "A", "U", "auditor"),
    userSeed("admin-id", "admin@test.com", "A", "D", "tech_admin"),
  ]);
}

async function seedReferentials(orm: MikroORM) {
  await (
    orm.em.getRepository(DataCategoryEntity).insert as unknown as (data: unknown) => Promise<void>
  )([
    { id: "dc-identity", code: "identity", label: "Identité" },
    { id: "dc-contact", code: "contact", label: "Contact" },
    { id: "dc-financial", code: "financial", label: "Financier" },
    { id: "dc-health", code: "health", label: "Santé" },
  ]);

  await (orm.em.getRepository(PurposeEntity).insert as unknown as (data: unknown) => Promise<void>)(
    [
      { id: "p-support", code: "support", label: "Support client" },
      { id: "p-billing", code: "billing", label: "Facturation" },
      { id: "p-legal", code: "legal", label: "Obligation légale" },
    ],
  );

  await (
    orm.em.getRepository(LegalBasisEntity).insert as unknown as (data: unknown) => Promise<void>
  )([
    {
      id: "lb-6-1-b",
      code: "art6.1b",
      label: "Exécution d'un contrat (art. 6.1.b)",
      isArticle9: false,
    },
    { id: "lb-6-1-c", code: "art6.1c", label: "Obligation légale (art. 6.1.c)", isArticle9: false },
    {
      id: "lb-9-2-h",
      code: "art9.2h",
      label: "Médecine préventive (art. 9.2.h)",
      isArticle9: true,
    },
    {
      id: "lb-9-2-a",
      code: "art9.2a",
      label: "Consentement explicite (art. 9.2.a)",
      isArticle9: true,
    },
  ]);
}

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .start();

  process.env.TEST_DATABASE_URL = container.getConnectionUri();

  const orm = await MikroORM.init({
    entities: [...accessRegistryEntities, ...auditLogEntities, ...userEntities],
    clientUrl: process.env.TEST_DATABASE_URL,
  });

  await orm.schema.refresh();
  await orm.em.execute(APPEND_ONLY_DDL_TEST);
  await seedUsers(orm);
  await seedReferentials(orm);
  await orm.close();
}

export async function teardown() {
  if (container) {
    await container.stop();
  }
}
