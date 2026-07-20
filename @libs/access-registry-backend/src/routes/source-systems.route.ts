import type { FastifyInstanceTypeForModule } from "#src/init.js";
import { randomUUID } from "node:crypto";
import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { array, object, string } from "zod";
import {
  jsonApiErrorDocumentSchema,
  makeJsonApiError,
  makeSingleJsonApiTopDocument,
  type Route,
} from "@libs/backend-shared";
import type { EntityManager } from "@mikro-orm/postgresql";
import { requirePermission } from "@libs/permissions-backend";
import { SourceSystemEntity } from "#src/entities/source-system.entity.js";
import {
  jsonApiSerializeSourceSystem,
  SerializedSourceSystemSchema,
} from "#src/serializers/referential.serializer.js";

// Dérive un code stable et URL-safe depuis un libellé libre saisi par l'utilisateur.
export function slugifySourceSystem(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class SourceSystemsRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get(
      "/source-systems",
      { schema: { response: { 200: object({ data: array(SerializedSourceSystemSchema) }) } } },
      async (_request, reply) => {
        const items = await this.em
          .getRepository(SourceSystemEntity)
          .findAll({ orderBy: { label: "ASC" } });
        return reply.send({ data: items.map(jsonApiSerializeSourceSystem) });
      },
    );
  }
}

// Création d'un système source par un encodeur. Idempotent : si le code dérivé
// existe déjà, on renvoie l'existant plutôt qu'une 409, pour une UX fluide côté
// formulaire (l'utilisateur re-saisit le même système sans erreur).
export class CreateSourceSystemRoute implements Route {
  public constructor(private em: EntityManager) {}

  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.post(
      "/source-systems",
      {
        preHandler: [requirePermission("create", "AccessRecord")],
        schema: {
          body: makeSingleJsonApiTopDocument(
            object({
              id: string().optional().nullable(),
              type: string().optional(),
              attributes: object({ label: string().min(1) }),
            }),
          ),
          response: {
            200: makeSingleJsonApiTopDocument(SerializedSourceSystemSchema),
            400: jsonApiErrorDocumentSchema,
          },
        },
      },
      async (request, reply) => {
        const label = request.body.data.attributes.label.trim();
        const code = slugifySourceSystem(label);

        // Un libellé composé uniquement de ponctuation/espaces (ex. "!!!") passe
        // la validation `min(1)` mais slugifie en chaîne vide : on refuse plutôt
        // que de créer un référentiel au code vide et non descriptif.
        if (!code) {
          return reply.code(400).send(
            makeJsonApiError(400, "Validation Error", {
              code: "INVALID_SOURCE_SYSTEM_LABEL",
              detail: "le libellé doit contenir au moins un caractère alphanumérique",
              source: { pointer: "/data/attributes/label" },
            }),
          );
        }

        const repository = this.em.getRepository(SourceSystemEntity);

        const existing = await repository.findOne({ code });
        if (existing) {
          return reply.send({ data: jsonApiSerializeSourceSystem(existing) });
        }

        const entity = { id: randomUUID(), code, label };
        try {
          await repository.insert(entity);
        } catch (error) {
          // Course entre le findOne ci-dessus et l'insert : deux requêtes
          // concurrentes pour un même code neuf passent toutes deux le findOne,
          // l'une viole la contrainte d'unicité. On retombe alors sur l'existant
          // (idempotence) plutôt que de renvoyer une 500.
          if (error instanceof UniqueConstraintViolationException) {
            const raced = await repository.findOne({ code });
            if (raced) {
              return reply.send({ data: jsonApiSerializeSourceSystem(raced) });
            }
          }
          throw error;
        }

        return reply.send({ data: jsonApiSerializeSourceSystem(entity) });
      },
    );
  }
}
