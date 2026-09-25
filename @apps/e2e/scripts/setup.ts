import { execSync } from "node:child_process";
import {
  createLogger,
  E2E_DIR,
  ensurePostgresRunning,
  setupE2EDatabase,
} from "./docker-postgres.js";

const logger = createLogger("e2e-setup");

function installPlaywrightBrowsers() {
  logger.log("Ensuring Playwright browsers are installed...");
  try {
    execSync("pnpm exec playwright install chromium", { cwd: E2E_DIR, stdio: "inherit" });
    logger.success("Playwright browsers ready!");
  } catch (err) {
    logger.error("Failed to install Playwright browsers");
    throw err;
  }
}

async function main() {
  logger.log("Starting e2e test setup...\n");

  await ensurePostgresRunning(logger);
  setupE2EDatabase(logger);
  installPlaywrightBrowsers();

  logger.success("\nE2E setup complete! Ready to run tests.\n");
}

main().catch((err) => {
  logger.error(`Setup failed: ${err}`);
  process.exit(1);
});
