import { RoleChangeset } from '#src/changesets/role.ts';
import RoleForm from '#src/components/forms/role-form.gts';
import RolePermissionMatrix from '#src/components/role-permission-matrix.gts';
import Component from '@glimmer/component';
import type { RolesEditRouteSignature } from './edit.gts';
import { editRoleValidationSchema } from '#src/components/forms/role-validation.ts';
import type { IntlService } from 'ember-intl';
import { service } from '@ember/service';
import type Owner from '@ember/owner';
import { t } from 'ember-intl';
import { array } from '@ember/helper';

export default class RolesEditRouteTemplate extends Component<RolesEditRouteSignature> {
  @service declare intl: IntlService;
  validationSchema: ReturnType<typeof editRoleValidationSchema>;

  constructor(owner: Owner, args: RolesEditRouteSignature) {
    super(owner, args);
    this.validationSchema = editRoleValidationSchema(this.intl);
  }

  changeset = new RoleChangeset({
    id: this.args.model.role.id,
    name: this.args.model.role.name,
    description: this.args.model.role.description,
  });

  get roleId(): string {
    return this.args.model.role.id ?? '';
  }

  <template>
    <h1 class="text-3xl font-semibold mb-6">{{t
        "permissions.forms.role.editTitle"
      }}</h1>
    <RoleForm
      @changeset={{this.changeset}}
      @validationSchema={{this.validationSchema}}
    />

    <h2 class="text-xl font-semibold mt-10 mb-4">{{t
        "permissions.forms.role.matrix.title"
      }}</h2>
    <RolePermissionMatrix
      @roleId={{this.roleId}}
      @rules={{if @model.role.rules @model.role.rules (array)}}
    />
  </template>
}
