import { defineEntity, p, type InferEntity } from "@mikro-orm/core";
import { RoleEntity } from "#src/entities/role.entity.js";

// @lat: [[backend/permissions#Modèle de règles CASL en base]]
export const PermissionRuleEntity = defineEntity({
  name: "PermissionRule",
  properties: {
    id: p.string().primary(),
    role: p.manyToOne(RoleEntity),
    action: p.string(),
    subject: p.string(),
    conditions: p.json().nullable(),
    fields: p.json().nullable(),
    inverted: p.boolean().default(false),
    order: p.integer().default(0),
  },
});

export type PermissionRuleEntityType = InferEntity<typeof PermissionRuleEntity>;
