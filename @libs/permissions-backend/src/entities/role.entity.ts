import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const RoleEntity = defineEntity({
  name: "Role",
  properties: {
    id: p.string().primary(),
    name: p.string().unique(),
    description: p.string().nullable(),
  },
});

export type RoleEntityType = InferEntity<typeof RoleEntity>;
