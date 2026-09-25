import { createApplicationContext } from "#src/app/application.context.js";
import type { AppConfiguration } from "#src/configuration.js";

// oxlint-disable-next-line max-lines-per-function
export async function getTestContext(overrides: Partial<AppConfiguration> = {}) {
  const config = {
    DEBUG: true,
    PRODUCTION_ENV: false,
    PORT: 8001,
    DATABASE_URI: process.env.TEST_DATABASE_URL ?? "",
    SERVER_URL: "http://localhost:8001",
    SEED: "test",
    SESSION_KEY: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    JWT_SECRET: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    JWT_REFRESH_SECRET: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    APP_NAME: "TestApp",
    APP_URL: "http://localhost:8001",
    SMTP_HOST: "smtp.test.com",
    SMTP_PORT: "587",
    SMTP_USER: "test@example.com",
    SMTP_PASSWORD: "test_password",
    SMTP_SECURE: false,
    EMAIL_FROM_NAME: "Test App",
    EMAIL_FROM_ADDRESS: "noreply@test.com",
    // Les tests d'intégration tournent sur leur propre testcontainer : jamais
    // de bascule vers la base e2e.
    E2E: false,
    // Tous les domaines montés : un test doit exercer le produit complet, sinon
    // une suite verte ne dirait rien des routes réellement servies.
    //
    // ⚠️ Ce stub est une SECONDE liste des clés de `configuration.ts`, tenue à
    // la main : toute nouvelle variable doit être ajoutée ici aussi. Le
    // `satisfies` ci-dessous le signale au type-check — mais `@apps/backend` n'a
    // pas de script `lint:types` et la CI ne type-check pas le backend, donc
    // rien ne le dit avant qu'un test ne casse. C'est déjà arrivé avec
    // EXPORT_SIGNING_KEY, qui manque toujours ici.
    FEATURE_TODOS: true,
    FEATURE_ACCESS_REGISTRY: true,
    FEATURE_INCIDENT_REGISTRY: true,
  } satisfies AppConfiguration;

  return {
    context: await createApplicationContext({ ...config, ...overrides }),
  };
}
