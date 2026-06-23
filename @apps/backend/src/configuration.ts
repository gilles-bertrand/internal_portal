import { object, string } from "zod";
import type z from "zod";

const schema = object({
  PORT: string().transform(Number),
  SERVER_URL: string(),
  PRODUCTION_ENV: string().transform((v) => v === "true"),
  DEBUG: string()
    .transform((v) => v === "true")
    .default(false),
  DATABASE_URI: string(),
  SESSION_KEY: string(),
  JWT_SECRET: string(),
  JWT_REFRESH_SECRET: string(),
  SEED: string().default("42").optional(),
  APP_NAME: string().default("Registr"),
  APP_URL: string().default("http://localhost:3000"),
  APP_LOGO_URL: string().optional(),
  SMTP_HOST: string(),
  SMTP_PORT: string(),
  SMTP_USER: string(),
  SMTP_PASSWORD: string(),
  SMTP_SECURE: string().transform((v) => v === "true"),
  EMAIL_FROM_NAME: string().default("Registr Support"),
  EMAIL_FROM_ADDRESS: string().default("support@example.com"),
  EXPORT_SIGNING_KEY: string(),
});

export type AppConfiguration = z.infer<typeof schema>;

export function loadConfiguration() {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const name = issue.path.join(".");
        const reason = process.env[name] === undefined ? "manquante" : issue.message;
        return `  - ${name}: ${reason}`;
      })
      .join("\n");

    throw new Error(
      `Configuration d'environnement invalide. Vérifie ton fichier @apps/backend/.env ` +
        `(source de vérité : .env.enc déchiffré via SOPS, voir scripts/dev-setup.mjs) :\n${details}`,
    );
  }

  return result.data;
}
