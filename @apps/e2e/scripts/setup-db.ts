import { createLogger, ensurePostgresRunning, setupE2EDatabase } from "./docker-postgres.js";

const logger = createLogger("e2e-setup-db");

async function main() {
  logger.log("Starting e2e database setup...\n");

  await ensurePostgresRunning(logger);
  setupE2EDatabase(logger);

  logger.success("\nE2E database setup complete!\n");
}

main().catch((err) => {
  logger.error(`Database setup failed: ${err}`);
  process.exit(1);
});
