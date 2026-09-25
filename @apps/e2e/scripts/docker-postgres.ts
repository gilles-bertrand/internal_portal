import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const ROOT_DIR = path.resolve(import.meta.dirname, "../../..");
export const BACKEND_DIR = path.resolve(ROOT_DIR, "@apps/backend");
export const E2E_DIR = path.resolve(ROOT_DIR, "@apps/e2e");

export function createLogger(scope: string) {
  return {
    log: (message: string) => console.log(`\x1b[36m[${scope}]\x1b[0m ${message}`),
    error: (message: string) => console.error(`\x1b[31m[${scope}]\x1b[0m ${message}`),
    success: (message: string) => console.log(`\x1b[32m[${scope}]\x1b[0m ${message}`),
  };
}

type Logger = ReturnType<typeof createLogger>;

function isDockerRunning(): boolean {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Interroge le service `database` du docker-compose du dépôt plutôt qu'une image
 * précise : filtrer sur `ancestor=postgres:<version>` cassait silencieusement à
 * chaque montée de version de l'image.
 */
function isPostgresReady(): boolean {
  try {
    execSync("docker compose exec -T database pg_isready -U backend_user", {
      cwd: ROOT_DIR,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

async function waitForPostgres(logger: Logger, maxAttempts = 30) {
  logger.log("Waiting for PostgreSQL to be ready...");

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (isPostgresReady()) {
      logger.success("PostgreSQL is ready!");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`PostgreSQL failed to start within ${maxAttempts} seconds`);
}

/**
 * Démarre le Postgres du docker-compose si nécessaire et attend qu'il réponde.
 * Sort en erreur si Docker n'est pas disponible.
 */
export async function ensurePostgresRunning(logger: Logger) {
  if (!isDockerRunning()) {
    logger.error("Docker is not running. Please start Docker and try again.");
    process.exit(1);
  }

  if (isPostgresReady()) {
    logger.log("PostgreSQL is already running");
    return;
  }

  logger.log("Starting PostgreSQL via docker compose...");
  execSync("docker compose up -d database", { cwd: ROOT_DIR, stdio: "inherit" });
  await waitForPostgres(logger);
}

/**
 * Recrée le schéma et rejoue l'E2ESeeder sur la base e2e dédiée.
 *
 * `pnpm e2e:setup` tourne en `--mode=e2e` : la base visée est `database_e2e`,
 * jamais la base de développement.
 */
export function setupE2EDatabase(logger: Logger) {
  logger.log("Setting up e2e database schema and seeding data...");

  const envPath = path.join(BACKEND_DIR, ".env.e2e");
  if (!existsSync(envPath)) {
    logger.error(`.env.e2e not found at ${envPath}`);
    logger.error("Decrypt it first (SOPS) — see tuto/2_sops.md.");
    process.exit(1);
  }

  try {
    execSync("pnpm e2e:setup", { cwd: BACKEND_DIR, stdio: "inherit" });
    logger.success("Database setup complete!");
  } catch (err) {
    logger.error("Failed to setup database");
    throw err;
  }
}
