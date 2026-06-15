import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const DataCategoryEntity = defineEntity({
  name: "DataCategory",
  tableName: "data_category",
  properties: {
    id: p.string().primary(),
    code: p.string().unique(),
    label: p.string(),
  },
});

export type DataCategoryEntityType = InferEntity<typeof DataCategoryEntity>;
