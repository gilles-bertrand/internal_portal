import { boolean, object, string } from "zod";
import { z } from "zod";
import { makeJsonApiDocumentSchema } from "@libs/backend-shared";
import type { DataCategoryEntityType } from "#src/entities/data-category.entity.js";
import type { PurposeEntityType } from "#src/entities/purpose.entity.js";
import type { LegalBasisEntityType } from "#src/entities/legal-basis.entity.js";
import type { SourceSystemEntityType } from "#src/entities/source-system.entity.js";

// @lat: [[backend/access-registry#Référentiels bilingues (label / labelEn)]]
// Les référentiels exposent les DEUX libellés plutôt qu'un seul résolu côté
// serveur via Accept-Language : le sélecteur de langue du dashboard change la
// locale sans rechargement, donc un libellé figé au fetch resterait dans
// l'ancienne langue. Le frontend choisit à l'affichage.
const bilingualLabel = { code: string(), label: string(), labelEn: string().nullable() };

export const SerializedDataCategorySchema = makeJsonApiDocumentSchema(
  "data-categories",
  object({ ...bilingualLabel }),
);

export const SerializedPurposeSchema = makeJsonApiDocumentSchema(
  "purposes",
  object({ ...bilingualLabel }),
);

export const SerializedLegalBasisSchema = makeJsonApiDocumentSchema(
  "legal-bases",
  object({ ...bilingualLabel, isArticle9: boolean() }),
);

export const SerializedSourceSystemSchema = makeJsonApiDocumentSchema(
  "source-systems",
  object({ ...bilingualLabel }),
);

export function jsonApiSerializeDataCategory(
  e: DataCategoryEntityType,
): z.infer<typeof SerializedDataCategorySchema> {
  return {
    id: e.id,
    type: "data-categories" as const,
    attributes: { code: e.code, label: e.label, labelEn: e.labelEn ?? null },
  };
}

export function jsonApiSerializePurpose(
  e: PurposeEntityType,
): z.infer<typeof SerializedPurposeSchema> {
  return {
    id: e.id,
    type: "purposes" as const,
    attributes: { code: e.code, label: e.label, labelEn: e.labelEn ?? null },
  };
}

export function jsonApiSerializeLegalBasis(
  e: LegalBasisEntityType,
): z.infer<typeof SerializedLegalBasisSchema> {
  return {
    id: e.id,
    type: "legal-bases" as const,
    attributes: {
      code: e.code,
      label: e.label,
      labelEn: e.labelEn ?? null,
      isArticle9: e.isArticle9,
    },
  };
}

export function jsonApiSerializeSourceSystem(
  e: SourceSystemEntityType,
): z.infer<typeof SerializedSourceSystemSchema> {
  return {
    id: e.id,
    type: "source-systems" as const,
    attributes: { code: e.code, label: e.label, labelEn: e.labelEn ?? null },
  };
}
