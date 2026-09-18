import type { FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

/**
 * Pointer JSON:API d'une issue de validation de requête, normalisé.
 *
 * Deux formes arrivent ici selon le validateur : AJV expose `instancePath`
 * (`/data/attributes/version`, avec un slash de tête DÉJÀ présent),
 * fastify-type-provider-zod remonte plutôt un `path` tableau
 * (`["data","attributes","version"]`). On accepte les deux, et on retombe sur
 * `/data` quand la forme est inconnue plutôt que d'omettre le pointer dont le
 * front se sert pour placer l'erreur sur le bon champ.
 *
 * LE SLASH DE TÊTE EST LE PIÈGE. `instancePath` commence déjà par `/` :
 * préfixer naïvement produisait `//email`, et le front dérive la clé du champ
 * de ce pointer — un double slash lui donnait une clé inexploitable, donc
 * l'erreur serveur ne se rattachait à AUCUN input. Le segment vide est écarté
 * par `filter(Boolean)`, ce qui rend la normalisation idempotente quelle que
 * soit la forme reçue.
 *
 * @lat: [[backend/platform#Le pointer d'erreur ne doit pas être doublé]]
 */
export function jsonApiValidationPointer(issue: unknown): string {
  const candidate = issue as { instancePath?: unknown; path?: unknown };
  const raw =
    typeof candidate.instancePath === "string" && candidate.instancePath.length > 0
      ? candidate.instancePath.replace(/\./g, "/")
      : Array.isArray(candidate.path) && candidate.path.length > 0
        ? candidate.path.map(String).join("/")
        : "data";
  return `/${raw.split("/").filter(Boolean).join("/")}`;
}

// @lat: [[backend/platform#Enveloppe JSON:API et gestion d'erreurs partagées]]
//
// CE handler est celui qui répond réellement pour les routes de modules : chaque
// `*-backend/src/init.ts` l'installe sur SON scope Fastify, et un handler de
// scope interne l'emporte sur celui du composition root. Le handler global de
// `@apps/backend/src/app/app.ts` ne voit donc que les routes hors module —
// autant dire presque rien. Toute correction du format d'erreur doit passer
// ici, sous peine d'être du code mort.
export function handleJsonApiErrors(error: unknown, _request: FastifyRequest, reply: FastifyReply) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({
      errors: error.validation.map((issue) => ({
        status: "400",
        code: "VALIDATION_ERROR",
        title: "Validation Error",
        detail: issue.message,
        source: {
          pointer: jsonApiValidationPointer(issue),
        },
      })),
    });
  }

  throw error;
}
