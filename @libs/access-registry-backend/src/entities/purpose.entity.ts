import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const PurposeEntity = defineEntity({
  name: "Purpose",
  tableName: "purpose",
  properties: {
    id: p.string().primary(),
    code: p.string().unique(),
    label: p.string(),
  },
});

export type PurposeEntityType = InferEntity<typeof PurposeEntity>;
