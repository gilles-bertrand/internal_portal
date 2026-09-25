import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const PurposeEntity = defineEntity({
  name: "Purpose",
  tableName: "purpose",
  properties: {
    id: p.string().primary(),
    code: p.string().unique(),
    label: p.string(),
    // Libellé anglais du référentiel. Nullable : les référentiels créés à la
    // volée (ou antérieurs à la mise en bilingue) n'en ont pas — le frontend
    // retombe alors sur `label` (français).
    labelEn: p.string().nullable(),
  },
});

export type PurposeEntityType = InferEntity<typeof PurposeEntity>;
