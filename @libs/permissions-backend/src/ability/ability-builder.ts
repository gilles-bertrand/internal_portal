import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import type { PermissionRuleEntityType } from "#src/entities/permission-rule.entity.js";

export type AppAbility = MongoAbility<[string, string]>;

interface UserForAbility {
  id: string;
}

function interpolate(
  conditions: Record<string, unknown> | null | undefined,
  user: UserForAbility,
): Record<string, unknown> | undefined {
  if (!conditions) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(conditions)) {
    result[key] = value === "$user.id" ? user.id : value;
  }
  return result;
}

// @lat: [[backend/permissions#Construction de l'ability CASL depuis les règles en base]]
export function buildAbility(rules: PermissionRuleEntityType[], user: UserForAbility): AppAbility {
  const rawRules: RawRuleOf<AppAbility>[] = [...rules]
    .sort((a, b) => a.order - b.order)
    .map((rule) => ({
      action: rule.action,
      subject: rule.subject,
      conditions: interpolate(rule.conditions as Record<string, unknown> | null, user),
      inverted: rule.inverted,
    }));

  return createMongoAbility<AppAbility>(rawRules);
}
