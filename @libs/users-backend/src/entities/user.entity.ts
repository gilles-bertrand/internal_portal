import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export type UserRole = "encoder" | "dpo" | "auditor" | "tech_admin";

export const UserEntity = defineEntity({
  name: "User",
  properties: {
    id: p.string().primary(),
    email: p.string(),
    firstName: p.string(),
    lastName: p.string(),
    password: p.string(),
    role: p.string<UserRole>().default("encoder"),
    failedLoginAttempts: p.integer().default(0),
    lockedUntil: p.string().nullable(),
    passwordChangedAt: p.string().nullable(),
  },
});

export type UserEntityType = InferEntity<typeof UserEntity>;
