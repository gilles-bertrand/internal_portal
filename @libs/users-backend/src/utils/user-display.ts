import type { EntityManager } from "@mikro-orm/postgresql";
import { UserEntity, type UserEntityType } from "#src/entities/user.entity.js";

// Résolution du nom affichable d'un acteur, à la volée.
//
// Vit ici et non dans chaque domaine : le nom d'un utilisateur est une donnée
// du domaine `users`, et trois registres qui le recalculent chacun de leur côté
// finissent par en donner trois formes. Cette fonction existait déjà en deux
// copies identiques (access-registry et incident-registry) avant d'être
// mutualisée ; le journal d'audit en avait besoin d'une troisième.
//
// Le nom n'est JAMAIS stocké sur l'enregistrement : un registre append-only
// figerait alors une identité qui, elle, peut légitimement changer.
// @lat: [[backend/users-auth#Nom d'affichage résolu à la volée]]
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
