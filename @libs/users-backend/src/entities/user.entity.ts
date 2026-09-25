import { defineEntity, p, type InferEntity } from "@mikro-orm/core";
import { RoleEntity } from "@libs/permissions-backend";

// @lat: [[backend/permissions#Migration de UserEntity.role vers une relation]]
export const UserEntity = defineEntity({
  name: "User",
  properties: {
    id: p.string().primary(),
    email: p.string(),
    firstName: p.string(),
    lastName: p.string(),
    password: p.string(),
    role: p.manyToOne(RoleEntity),
    failedLoginAttempts: p.integer().default(0),
    lockedUntil: p.string().nullable(),
    passwordChangedAt: p.string().nullable(),
  },
});

export type UserEntityType = InferEntity<typeof UserEntity>;
