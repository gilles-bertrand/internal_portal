import { subject } from "@casl/ability";
import { describe, expect, it } from "vitest";
import { buildAbility } from "#src/ability/ability-builder.js";
import type { PermissionRuleEntityType } from "#src/entities/permission-rule.entity.js";

function rule(overrides: Partial<PermissionRuleEntityType>): PermissionRuleEntityType {
  return {
    id: "rule-1",
    role: "role-1",
    action: "read",
    subject: "AccessRecord",
    conditions: null,
    fields: null,
    inverted: false,
    order: 0,
    ...overrides,
  } as PermissionRuleEntityType;
}

describe("buildAbility", () => {
  it("allows an action explicitly granted", () => {
    const ability = buildAbility([rule({ action: "create", subject: "AccessRecord" })], {
      id: "user-1",
    });

    expect(ability.can("create", "AccessRecord")).toBe(true);
    expect(ability.can("delete", "AccessRecord")).toBe(false);
  });

  it("interpolates $user.id in conditions", () => {
    const ability = buildAbility(
      [rule({ action: "read", subject: "AccessRecord", conditions: { encodedBy: "$user.id" } })],
      { id: "user-42" },
    );

    // `subject()` tags a plain object with its subject type for CASL's runtime
    // condition matching; the `[string, string]` ability tuple types the 2nd
    // `can()` param as a bare string, so the cast reconciles a stricter type
    // with a documented, supported CASL runtime pattern.
    expect(ability.can("read", subject("AccessRecord", { encodedBy: "user-42" }) as never)).toBe(
      true,
    );
    expect(
      ability.can("read", subject("AccessRecord", { encodedBy: "someone-else" }) as never),
    ).toBe(false);
  });

  it("lets a later 'cannot' rule override an earlier 'can' when ordered higher", () => {
    const ability = buildAbility(
      [
        rule({ id: "r1", action: "manage", subject: "AccessRecord", order: 0 }),
        rule({ id: "r2", action: "manage", subject: "AccessRecord", inverted: true, order: 10 }),
      ],
      { id: "user-1" },
    );

    expect(ability.can("manage", "AccessRecord")).toBe(false);
  });

  it("treats 'manage' as covering every action on the subject", () => {
    const ability = buildAbility([rule({ action: "manage", subject: "User" })], { id: "user-1" });

    expect(ability.can("create", "User")).toBe(true);
    expect(ability.can("delete", "User")).toBe(true);
  });

  it("returns an ability that denies everything when given no rules", () => {
    const ability = buildAbility([], { id: "user-1" });

    expect(ability.can("read", "AccessRecord")).toBe(false);
  });
});
