import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const RetentionPolicyEntity = defineEntity({
  name: "RetentionPolicy",
  tableName: "retention_policy",
  properties: {
    id: p.string().primary(),
    category: p.string().unique(),
    durationDays: p.integer(),
  },
});

export type RetentionPolicyEntityType = InferEntity<typeof RetentionPolicyEntity>;
