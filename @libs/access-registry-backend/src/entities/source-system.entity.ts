import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const SourceSystemEntity = defineEntity({
  name: "SourceSystem",
  tableName: "source_system",
  properties: {
    id: p.string().primary(),
    code: p.string().unique(),
    label: p.string(),
  },
});

export type SourceSystemEntityType = InferEntity<typeof SourceSystemEntity>;
