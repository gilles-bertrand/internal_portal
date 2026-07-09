import { array, boolean, number, object, string, z } from "zod";
import { makeJsonApiDocumentSchema } from "@libs/backend-shared";
import type { RoleEntityType } from "#src/entities/role.entity.js";
import type { PermissionRuleEntityType } from "#src/entities/permission-rule.entity.js";

export const PermissionRuleSchema = object({
  action: string(),
  subject: string(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  fields: array(string()).nullable().optional(),
  inverted: boolean(),
  order: number(),
});

export const SerializedRoleSchema = makeJsonApiDocumentSchema(
  "roles",
  object({
    name: string(),
    description: string().nullable(),
    rules: array(PermissionRuleSchema).optional(),
  }),
);

export function jsonApiSerializeRole(
  role: RoleEntityType,
  rules?: PermissionRuleEntityType[],
): z.infer<typeof SerializedRoleSchema> {
  return {
    id: role.id,
    type: "roles" as const,
    attributes: {
      name: role.name,
      description: role.description ?? null,
      rules: rules?.map((rule) => ({
        action: rule.action,
        subject: rule.subject,
        conditions: rule.conditions as Record<string, unknown> | null,
        fields: rule.fields as string[] | null,
        inverted: rule.inverted,
        order: rule.order,
      })),
    },
  };
}

export function jsonApiSerializeManyRoles(roles: RoleEntityType[]) {
  return roles.map((role) => jsonApiSerializeRole(role));
}

export function jsonApiSerializeSingleRoleDocument(
  role: RoleEntityType,
  rules?: PermissionRuleEntityType[],
) {
  return {
    data: jsonApiSerializeRole(role, rules),
  };
}

export function jsonApiSerializeManyRolesDocument(roles: RoleEntityType[]) {
  return {
    data: jsonApiSerializeManyRoles(roles),
  };
}
