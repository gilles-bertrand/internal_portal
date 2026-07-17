import type { AppAbility } from "@libs/permissions-backend";

// @lat: [[backend/access-registry#Filtre de liste dérivé de la condition CASL de l'encoder]]
export function extractEqualityCondition(
  ability: AppAbility,
  action: string,
  subject: string,
  field: string,
): string | undefined {
  const rule = ability.rulesFor(action, subject).find((r) => r.conditions?.[field]);
  return rule?.conditions?.[field] as string | undefined;
}
