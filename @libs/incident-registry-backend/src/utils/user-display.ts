import type { EntityManager } from "@mikro-orm/postgresql";
import { UserEntity, type UserEntityType } from "@libs/users-backend";

export function userNameFor(user: UserEntityType | undefined, fallback: string): string {
  if (!user) {
    return fallback;
  }
  return `${user.firstName} ${user.lastName}`;
}

export async function loadUsersByIds(
  em: EntityManager,
  ids: string[],
): Promise<Map<string, UserEntityType>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const users = await em.getRepository(UserEntity).find({ id: { $in: uniqueIds } });
  return new Map(users.map((user) => [user.id, user]));
}
