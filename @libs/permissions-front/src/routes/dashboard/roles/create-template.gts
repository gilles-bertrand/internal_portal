import { RoleChangeset } from '#src/changesets/role.ts';
import RoleForm from '#src/components/forms/role-form.gts';
import Component from '@glimmer/component';
import type { RolesCreateRouteSignature } from './create.gts';
import type Owner from '@ember/owner';
import type { IntlService } from 'ember-intl';
import { service } from '@ember/service';
import { createRoleValidationSchema } from '#src/components/forms/role-validation.ts';
import { t } from 'ember-intl';

export default class RolesCreateRouteTemplate extends Component<RolesCreateRouteSignature> {
  @service declare intl: IntlService;
  validationSchema: ReturnType<typeof createRoleValidationSchema>;

  changeset = new RoleChangeset({});

  constructor(owner: Owner, args: RolesCreateRouteSignature) {
    super(owner, args);
    this.validationSchema = createRoleValidationSchema(this.intl);
  }

  <template>
    <h1 class="text-3xl font-semibold mb-6">{{t
        "permissions.forms.role.createTitle"
      }}</h1>
    <RoleForm
      @changeset={{this.changeset}}
      @validationSchema={{this.validationSchema}}
    />
  </template>
}
