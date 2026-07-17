import { click, render } from '@ember/test-helpers';
import { describe, expect as hardExpect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import RolePermissionMatrix from '#src/components/role-permission-matrix.gts';
import { initializeTestApp, TestApp } from '../app.ts';
import type RoleService from '#src/services/role.ts';
import type { PermissionRule } from '#src/schemas/roles.ts';

const expect = hardExpect.soft;

vi.mock('#src/services/role.ts', async (importActual) => {
  const actual = await importActual<typeof import('#src/services/role.ts')>();
  return {
    ...actual,
    default: class MockRoleService extends actual.default {
      updateRules = vi.fn().mockResolvedValue({});
    },
  };
});

const EXISTING_RULES: PermissionRule[] = [
  {
    action: 'manage',
    subject: 'User',
    conditions: null,
    fields: null,
    inverted: false,
    order: 0,
  },
];

const RULES_WITH_EXPLICIT_DENIES: PermissionRule[] = [
  ...EXISTING_RULES,
  {
    action: 'manage',
    subject: 'AccessRecord',
    conditions: null,
    fields: null,
    inverted: true,
    order: 1,
  },
  {
    action: 'manage',
    subject: 'Incident',
    conditions: null,
    fields: null,
    inverted: true,
    order: 2,
  },
];

describe('role-permission-matrix', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  renderingTest(
    'Renders a checkbox per action/subject pair',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');

      await render(
        <template>
          <RolePermissionMatrix @roleId="role-1" @rules={{EXISTING_RULES}} />
        </template>
      );

      expect(
        document.querySelector('[data-test-role-permission-matrix]')
      ).not.toBeNull();
      expect(
        document.querySelector(
          '[data-test-role-permission-checkbox="User:manage"]'
        )
      ).not.toBeNull();
    }
  );

  renderingTest(
    'Reflects existing rules as checked checkboxes',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');

      await render(
        <template>
          <RolePermissionMatrix @roleId="role-1" @rules={{EXISTING_RULES}} />
        </template>
      );

      const checkbox = document.querySelector(
        '[data-test-role-permission-checkbox="User:manage"]'
      ) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      const uncheckedBox = document.querySelector(
        '[data-test-role-permission-checkbox="Role:manage"]'
      ) as HTMLInputElement;
      expect(uncheckedBox.checked).toBe(false);
    }
  );

  renderingTest(
    'Toggling a checkbox persists the updated rule set via RoleService',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');

      const roleService = context.owner.lookup('service:role') as RoleService;

      await render(
        <template>
          <RolePermissionMatrix @roleId="role-42" @rules={{EXISTING_RULES}} />
        </template>
      );

      const checkbox = document.querySelector(
        '[data-test-role-permission-checkbox="Role:manage"]'
      ) as HTMLInputElement;
      await click(checkbox);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleService.updateRules).toHaveBeenCalledWith(
        'role-42',
        hardExpect.arrayContaining([
          hardExpect.objectContaining({ action: 'manage', subject: 'User' }),
          hardExpect.objectContaining({ action: 'manage', subject: 'Role' }),
        ])
      );
    }
  );

  renderingTest(
    'Unchecking a checkbox removes the rule from the persisted set',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');

      const roleService = context.owner.lookup('service:role') as RoleService;

      await render(
        <template>
          <RolePermissionMatrix @roleId="role-42" @rules={{EXISTING_RULES}} />
        </template>
      );

      const checkbox = document.querySelector(
        '[data-test-role-permission-checkbox="User:manage"]'
      ) as HTMLInputElement;
      await click(checkbox);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleService.updateRules).toHaveBeenCalledWith('role-42', []);
    }
  );

  renderingTest(
    'Preserves inverted rules when persisting matrix changes',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');

      const roleService = context.owner.lookup('service:role') as RoleService;

      await render(
        <template>
          <RolePermissionMatrix
            @roleId="role-42"
            @rules={{RULES_WITH_EXPLICIT_DENIES}}
          />
        </template>
      );

      const checkbox = document.querySelector(
        '[data-test-role-permission-checkbox="Role:manage"]'
      ) as HTMLInputElement;
      await click(checkbox);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleService.updateRules).toHaveBeenCalledWith(
        'role-42',
        hardExpect.arrayContaining([
          hardExpect.objectContaining({
            action: 'manage',
            subject: 'AccessRecord',
            inverted: true,
          }),
          hardExpect.objectContaining({
            action: 'manage',
            subject: 'Incident',
            inverted: true,
          }),
        ])
      );
    }
  );
});
