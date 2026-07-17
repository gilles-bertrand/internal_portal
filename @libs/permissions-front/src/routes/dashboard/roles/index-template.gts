import type { TOC } from '@ember/component/template-only';
import type { RolesIndexRouteSignature } from './index.gts';
import { LinkTo } from '@ember/routing';
import { t } from 'ember-intl';

export default <template>
  <div class="max-w-3xl">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-3xl font-semibold">{{t "permissions.roles.title"}}</h1>
      <LinkTo
        @route="dashboard.roles.create"
        class="btn btn-primary"
        data-test-role-create-link
      >
        {{t "permissions.roles.actions.create"}}
      </LinkTo>
    </div>
    <table class="table-auto w-full text-sm" data-test-roles-table>
      <thead>
        <tr>
          <th class="text-left p-2">{{t "permissions.roles.table.name"}}</th>
          <th class="text-left p-2">{{t
              "permissions.roles.table.description"
            }}</th>
          <th class="p-2"></th>
        </tr>
      </thead>
      <tbody>
        {{#each @model.roles as |role|}}
          <tr data-test-role-row={{role.id}}>
            <td class="p-2 font-medium">{{role.name}}</td>
            <td class="p-2 text-gray-500">{{role.description}}</td>
            <td class="p-2 text-right">
              <LinkTo @route="dashboard.roles.edit" @model={{role.id}}>
                {{t "permissions.roles.actions.edit"}}
              </LinkTo>
            </td>
          </tr>
        {{/each}}
      </tbody>
    </table>
  </div>
</template> as TOC<{
  model: RolesIndexRouteSignature['model'];
  controller: undefined;
}>
