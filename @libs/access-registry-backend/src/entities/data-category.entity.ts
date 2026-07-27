import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const DataCategoryEntity = defineEntity({
  name: "DataCategory",
  tableName: "data_category",
  properties: {
    id: p.string().primary(),
    code: p.string().unique(),
    label: p.string(),
    // Cf. PurposeEntity : libellé anglais optionnel, fallback frontend sur `label`.
    labelEn: p.string().nullable(),
  },
});

export type DataCategoryEntityType = InferEntity<typeof DataCategoryEntity>;
