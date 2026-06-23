import { boolean, object, string } from "zod";
import { z } from "zod";
import { makeJsonApiDocumentSchema } from "@libs/backend-shared";
import type { DataCategoryEntityType } from "#src/entities/data-category.entity.js";
import type { PurposeEntityType } from "#src/entities/purpose.entity.js";
import type { LegalBasisEntityType } from "#src/entities/legal-basis.entity.js";

export const SerializedDataCategorySchema = makeJsonApiDocumentSchema(
  "data-categories",
  object({ code: string(), label: string() }),
);

export const SerializedPurposeSchema = makeJsonApiDocumentSchema(
  "purposes",
  object({ code: string(), label: string() }),
);

export const SerializedLegalBasisSchema = makeJsonApiDocumentSchema(
  "legal-bases",
  object({ code: string(), label: string(), isArticle9: boolean() }),
);

export function jsonApiSerializeDataCategory(
  e: DataCategoryEntityType,
): z.infer<typeof SerializedDataCategorySchema> {
  return {
    id: e.id,
    type: "data-categories" as const,
    attributes: { code: e.code, label: e.label },
  };
}

export function jsonApiSerializePurpose(
  e: PurposeEntityType,
): z.infer<typeof SerializedPurposeSchema> {
  return { id: e.id, type: "purposes" as const, attributes: { code: e.code, label: e.label } };
}

export function jsonApiSerializeLegalBasis(
  e: LegalBasisEntityType,
): z.infer<typeof SerializedLegalBasisSchema> {
  return {
    id: e.id,
    type: "legal-bases" as const,
    attributes: { code: e.code, label: e.label, isArticle9: e.isArticle9 },
  };
}
