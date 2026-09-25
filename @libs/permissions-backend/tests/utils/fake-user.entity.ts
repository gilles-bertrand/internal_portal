import { defineEntity, p, type InferEntity } from "@mikro-orm/core";
import { RoleEntity } from "#src/entities/role.entity.js";

/**
 * Entité de test minimale portant une FK vers Role, pour exercer la
 * contrainte d'intégrité référentielle sans dépendre de users-backend
 * (qui dépend déjà de permissions-backend — un devDependency inverse
 * créerait un cycle de workspace).
 */
export const FakeUserEntity = defineEntity({
  name: "FakeUser",
  properties: {
    id: p.string().primary(),
    role: p.manyToOne(RoleEntity),
  },
});

export type FakeUserEntityType = InferEntity<typeof FakeUserEntity>;
