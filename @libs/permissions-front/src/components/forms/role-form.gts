import Component from '@glimmer/component';
import TpkForm from '@triptyk/ember-input-validation/components/tpk-form';
import { service } from '@ember/service';
import type RoleService from '#src/services/role.ts';
import type { RoleChangeset } from '#src/changesets/role.ts';
import {
  createRoleValidationSchema,
  editRoleValidationSchema,
  type CreatedRole,
  type UpdatedRole,
} from '#src/components/forms/role-validation.ts';
import type RouterService from '@ember/routing/router-service';
import { t, type IntlService } from 'ember-intl';
import { LinkTo } from '@ember/routing';
import type ImmerChangeset from 'ember-immer-changeset';
import HandleSaveService from '@libs/shared-front/services/handle-save';
import { create, fillable, clickable } from 'ember-cli-page-object';
import ArrowLeftIcon from '@libs/shared-front/assets/icons/arrow-left';

interface RoleFormArgs {
  changeset: RoleChangeset;
  validationSchema:
    | ReturnType<typeof createRoleValidationSchema>
    | ReturnType<typeof editRoleValidationSchema>;
}

interface RoleFormSignature {
  Args: RoleFormArgs;
  Blocks: {
    default: [];
  };
}

export default class RoleForm extends Component<RoleFormSignature> {
  @service declare role: RoleService;
  @service declare router: RouterService;
  @service declare intl: IntlService;
  @service declare handleSave: HandleSaveService;

  get isCreate() {
    return !this.args.changeset.get('id');
  }

  onSubmit = async (
    data: CreatedRole | UpdatedRole,
    c: ImmerChangeset<CreatedRole | UpdatedRole>
  ) => {
    // handleSave() intentionally discards saveAction's return value (it only
    // reports success/errors), so the newly created id is captured via this
    // closure instead — needed to redirect to the matrix-editing screen.
    let createdId: string | undefined;

    await this.handleSave.handleSave({
      saveAction: async () => {
        const result = await this.role.save(data);
        if (this.isCreate) createdId = result as string;
        return result;
      },
      changeset: c,
      successMessage: 'permissions.forms.role.messages.saveSuccess',
    });

    if (createdId) {
      void this.router.transitionTo('dashboard.roles.edit', createdId);
    }
  };

  <template>
    <h1 class="text-2xl font-semibold mb-4" data-test-role-form-title>
      {{if
        this.isCreate
        (t "permissions.forms.role.createTitle")
        (t "permissions.forms.role.editTitle")
      }}
    </h1>
    <TpkForm
      @changeset={{@changeset}}
      @onSubmit={{this.onSubmit}}
      @validationSchema={{@validationSchema}}
      data-test-role-form
      as |F|
    >
      <div class="grid grid-cols-12 gap-x-6 gap-y-3 max-w-2xl">
        <F.TpkInputPrefab
          @label={{t "permissions.forms.role.labels.name"}}
          @validationField="name"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkTextareaPrefab
          @label={{t "permissions.forms.role.labels.description"}}
          @validationField="description"
          class="col-span-12"
        />
        <div class="col-span-12 flex items-center justify-between gap-2">
          <button type="submit" class="btn btn-primary">
            {{t "permissions.forms.role.actions.submit"}}
          </button>
          <LinkTo
            @route="dashboard.roles"
            class="text-sm text-primary underline text-center mt-2 inline-flex items-center gap-1"
          >
            <ArrowLeftIcon class="size-4" />
            {{t "permissions.forms.role.actions.back"}}
          </LinkTo>
        </div>
      </div>
    </TpkForm>
  </template>
}

export const pageObject = create({
  scope: '[data-test-role-form]',
  name: fillable('[data-test-tpk-prefab-input-container="name"] input'),
  submit: clickable('button[type="submit"]'),
});
