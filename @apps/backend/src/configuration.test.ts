import { describe, it, expect, afterEach, vi } from "vitest";
import {
  assertE2ECommandTargetsE2EDatabase,
  E2E_DATABASE_NAME,
  loadConfiguration,
  withDatabaseName,
} from "./configuration.js";

const DEV_URI = "postgres://backend_user:backend_user@localhost:5432/database_dev";

/** Jeu d'environnement minimal accepté par le schéma de configuration. */
function stubValidEnvironment(overrides: Record<string, string> = {}) {
  const environment: Record<string, string> = {
    PORT: "8000",
    SERVER_URL: "http://localhost:8000",
    PRODUCTION_ENV: "false",
    DATABASE_URI: DEV_URI,
    SESSION_KEY: "session-key",
    JWT_SECRET: "jwt-secret",
    JWT_REFRESH_SECRET: "jwt-refresh-secret",
    SMTP_HOST: "localhost",
    SMTP_PORT: "1025",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    SMTP_SECURE: "false",
    EXPORT_SIGNING_KEY: "export-signing-key",
    // Explicite : sans ça, un `E2E=true` présent dans le shell du développeur
    // ferait passer le test « hors mode e2e » à côté de ce qu'il vérifie.
    E2E: "false",
    ...overrides,
  };

  for (const [key, value] of Object.entries(environment)) {
    vi.stubEnv(key, value);
  }
}

describe("withDatabaseName", () => {
  it("remplace uniquement le nom de base, en conservant identifiants, hôte et port", () => {
    expect(withDatabaseName(DEV_URI, E2E_DATABASE_NAME)).toBe(
      "postgres://backend_user:backend_user@localhost:5432/database_e2e",
    );
  });

  it("conserve les paramètres de connexion de l'URI d'origine", () => {
    const uri = withDatabaseName(
      "postgres://user:pass@db.internal:6432/database_dev?sslmode=require",
      E2E_DATABASE_NAME,
    );

    expect(uri).toBe("postgres://user:pass@db.internal:6432/database_e2e?sslmode=require");
  });
});

describe("loadConfiguration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // @lat: [[apps/e2e-strategy#Base e2e isolée de la base de développement]]
  it("bascule sur la base e2e quand E2E=true", () => {
    stubValidEnvironment({ E2E: "true" });

    expect(loadConfiguration().DATABASE_URI).toBe(
      "postgres://backend_user:backend_user@localhost:5432/database_e2e",
    );
  });

  it("laisse la DATABASE_URI intacte hors mode e2e", () => {
    stubValidEnvironment();

    expect(loadConfiguration().DATABASE_URI).toBe(DEV_URI);
  });
});

describe("assertE2ECommandTargetsE2EDatabase", () => {
  const E2E_URI = withDatabaseName(DEV_URI, E2E_DATABASE_NAME);
  const FRESH_ARGV = ["node", "cli.js", "schema:fresh", "--seed", "E2ESeeder", "--run"];

  // @lat: [[apps/e2e-strategy#Base e2e isolée de la base de développement]]
  it("refuse un schema:fresh --seed E2ESeeder dirigé vers la base de développement", () => {
    expect(() => assertE2ECommandTargetsE2EDatabase(DEV_URI, FRESH_ARGV)).toThrow(
      /database_dev.*database_e2e/s,
    );
  });

  it("laisse passer la même commande quand la cible est bien la base e2e", () => {
    expect(() => assertE2ECommandTargetsE2EDatabase(E2E_URI, FRESH_ARGV)).not.toThrow();
  });

  it("n'interfère pas avec les commandes non e2e sur la base de développement", () => {
    const argv = ["node", "cli.js", "schema:fresh", "--seed", "DatabaseSeeder", "--run"];

    expect(() => assertE2ECommandTargetsE2EDatabase(DEV_URI, argv)).not.toThrow();
  });
});
