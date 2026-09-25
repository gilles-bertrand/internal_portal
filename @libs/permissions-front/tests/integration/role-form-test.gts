import { describe, expect as hardExpect, vi } from 'vitest';
import { renderingTest } from 'ember-vitest';
import { render } from '@ember/test-helpers';
import { RoleChangeset } from '#src/changesets/role.ts';
import RoleForm, { pageObject } from '#src/components/forms/role-form.gts';
import { initializeTestApp, TestApp } from '../app.ts';
import type RoleService from '#src/services/role.ts';
import { stubRouter } from '../utils.ts';
import {
  createRoleValidationSchema,
  editRoleValidationSchema,
} from '#src/components/forms/role-validation.ts';

const expect = hardExpect.soft;

vi.mock('#src/services/role.ts', async (importActual) => {
  const actual = await importActual<typeof import('#src/services/role.ts')>();
  return {
    ...actual,
    default: class MockRoleService extends actual.default {
      save = vi.fn().mockResolvedValue('role-new-id');
    },
  };
});

describe('role-form', function () {
  // eslint-disable-next-line no-empty-pattern
  renderingTest.override({ app: ({}, use) => use(TestApp) });

  renderingTest(
    'Renders the form with its name field',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      stubRouter(context.owner);

      const intl = context.owner.lookup('service:intl');
      const changeset = new RoleChangeset({});
      const validationSchema = createRoleValidationSchema(intl);

      await render(
        <template>
          <RoleForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
          />
        </template>
      );

      expect(document.querySelector('[data-test-role-form]')).not.toBeNull();
      expect(
        document.querySelector('[data-test-tpk-prefab-input-container="name"]')
      ).not.toBeNull();
    }
  );

  renderingTest(
    'Does not call the role service when name is empty',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const router = stubRouter(context.owner);

      const roleService = context.owner.lookup('service:role') as RoleService;
      const intl = context.owner.lookup('service:intl');
      const changeset = new RoleChangeset({});
      const validationSchema = createRoleValidationSchema(intl);

      await render(
        <template>
          <RoleForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
          />
        </template>
      );

      await pageObject.submit();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleService.save).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(router.transitionTo).not.toHaveBeenCalled();
    }
  );

  renderingTest(
    'Calls the role service and redirects to edit when creating a valid role',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const router = stubRouter(context.owner);

      const roleService = context.owner.lookup('service:role') as RoleService;
      const intl = context.owner.lookup('service:intl');
      const changeset = new RoleChangeset({});
      const validationSchema = createRoleValidationSchema(intl);

      await render(
        <template>
          <RoleForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
          />
        </template>
      );

      await pageObject.name('supervisor');
      await pageObject.submit();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleService.save).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(router.transitionTo).toHaveBeenCalledWith(
        'dashboard.roles.edit',
        'role-new-id'
      );
    }
  );

  renderingTest(
    'Edit mode does not redirect on save',
    async function ({ context }) {
      initializeTestApp(context.owner, 'en-us');
      const router = stubRouter(context.owner);

      const roleService = context.owner.lookup('service:role') as RoleService;
      const intl = context.owner.lookup('service:intl');
      const changeset = new RoleChangeset({
        id: 'role-1',
        name: 'auditor',
        description: null,
      });
      const validationSchema = editRoleValidationSchema(intl);

      await render(
        <template>
          <RoleForm
            @changeset={{changeset}}
            @validationSchema={{validationSchema}}
          />
        </template>
      );

      await pageObject.submit();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(roleService.save).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(router.transitionTo).not.toHaveBeenCalled();
    }
  );
});
