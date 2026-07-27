import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const LegalBasisEntity = defineEntity({
  name: "LegalBasis",
  tableName: "legal_basis",
  properties: {
    id: p.string().primary(),
    code: p.string().unique(),
    label: p.string(),
    // Cf. PurposeEntity : libellé anglais optionnel, fallback frontend sur `label`.
    labelEn: p.string().nullable(),
    isArticle9: p.boolean().default(false),
  },
});

export type LegalBasisEntityType = InferEntity<typeof LegalBasisEntity>;
