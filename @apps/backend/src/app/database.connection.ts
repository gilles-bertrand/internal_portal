import { defineConfig, MikroORM } from "@mikro-orm/postgresql";
import type { AppConfiguration } from "../configuration.js";
import { RefreshTokenEntity, UserEntity } from "@libs/users-backend";
import { TodoEntity } from "@libs/todos-backend";
import { entities as accessRegistryEntities } from "@libs/access-registry-backend";
import { entities as auditLogEntities } from "@libs/audit-log-backend";
import { DatabaseSeeder } from "../seeders/development.seeder.js";
import { E2ESeeder } from "../seeders/e2e.seeder.js";

export function databaseConfig(config: Pick<AppConfiguration, "DATABASE_URI">) {
  return defineConfig({
    seeder: {
      pathTs: "./src/seeders",
      // Enregistrement explicite : la découverte par glob + import dynamique
      // de MikroORM échoue sous vite-node (`--seed <Class>` ne trouve pas la
      // classe). seedersList résout les noms sans scanner le disque.
      seedersList: [DatabaseSeeder, E2ESeeder],
    },
    clientUrl: config.DATABASE_URI,
    entities: [UserEntity, RefreshTokenEntity, TodoEntity, ...accessRegistryEntities, ...auditLogEntities],
  });
}

export async function createDatabaseConnection(config: Pick<AppConfiguration, "DATABASE_URI">) {
  const orm = await MikroORM.init(databaseConfig(config));
  return orm;
}
