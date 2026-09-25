import { defineConfig } from "@mikro-orm/postgresql";
import { assertE2ECommandTargetsE2EDatabase, loadConfiguration } from "./configuration.ts";
import { databaseConfig } from "./app/database.connection.ts";
import { seed } from "@ngneat/falso";

const config = loadConfiguration();

// Avant toute connexion : `schema:fresh --seed E2ESeeder` détruit le schéma.
assertE2ECommandTargetsE2EDatabase(config.DATABASE_URI, process.argv);

/**
 * Important for test reproduction
 */
seed(config.SEED);

export default defineConfig(databaseConfig(config));
