import Component from '@glimmer/component';
import { cached } from '@glimmer/tracking';
import type { ComponentLike } from '@glint/template';
import TpkForm from '@triptyk/ember-input-validation/components/tpk-form';
import { service } from '@ember/service';
import type UserService from '#src/services/user.ts';
import type { UserChangeset } from '#src/changesets/user.ts';
import {
  createUserValidationSchema,
  editUserValidationSchema,
  type UpdatedUser,
  type ValidatedUser,
} from '#src/components/forms/user-validation.ts';
import type RouterService from '@ember/routing/router-service';
import { create, fillable, clickable, isPresent } from 'ember-cli-page-object';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import { t, type IntlService } from 'ember-intl';
import { LinkTo } from '@ember/routing';
import type ImmerChangeset from 'ember-immer-changeset';
import HandleSaveService from '@libs/shared-front/services/handle-save';
import type { RoleSummary } from '#src/utils/role-summary.ts';
import ArrowLeftIcon from '@libs/shared-front/assets/icons/arrow-left';
import type AbilityService from '@libs/shared-front/services/ability';

interface RoleOption {
  value: string;
  label: string;
  toString(): string;
}

function roleOption(value: string, label: string): RoleOption {
  return { value, label, toString: () => label };
}

// power-select passes the selected item as `unknown`; it may be the stored
// id string or (transiently, before onChange normalises it) the option
// object — same shape as access-record-form's `codeOf`.
function idOf(selected: unknown): string {
  if (typeof selected === 'string') {
    return selected;
  }
  if (selected && typeof selected === 'object' && 'value' in selected) {
    return String(selected.value);
  }
  return '';
}

interface SelectedItemSignature {
  Args: {
    selected: unknown;
    extra?: unknown;
  };
  Blocks: { default: [] };
  Element: HTMLElement;
}

// TpkValidationSelectPrefab renders its trigger via `String(@selected)`, but
// the changeset only stores the role id — this resolves the label from the
// currently loaded options list.
// @lat: [[frontend/access-record-options#Référentiels dynamiques vs enum statique]]
function selectedOptionComponent(
  getOptions: () => RoleOption[]
): ComponentLike<SelectedItemSignature> {
  return class extends Component<SelectedItemSignature> {
    get label(): string {
      const id = idOf(this.args.selected);
      return id ? (getOptions().find((o) => o.value === id)?.label ?? '') : '';
    }
    <template>
      <span ...attributes>{{this.label}}{{yield}}</span>
    </template>
  };
}

interface UsersFormArgs {
  changeset: UserChangeset;
  validationSchema:
    | ReturnType<typeof createUserValidationSchema>
    | ReturnType<typeof editUserValidationSchema>;
  roles?: RoleSummary[];
}

interface UserFormSignature {
  Args: UsersFormArgs;
  Blocks: {
    default: [];
  };
}

export default class UsersForm extends Component<UserFormSignature> {
  @service declare user: UserService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;
  @service declare handleSave: HandleSaveService;
  @service declare ability: AbilityService;

  get isCreate() {
    return !this.args.changeset.get('id');
  }

  // @lat: [[backend/permissions#Création d'utilisateur guardée par manage:User]]
  get canAssignRole(): boolean {
    return this.ability.can('manage', 'User');
  }

  @cached
  get roleOptions(): RoleOption[] {
    return (this.args.roles ?? []).map((role) =>
      roleOption(role.id, role.name)
    );
  }

  @cached
  get roleSelectedItemComponent(): ComponentLike<SelectedItemSignature> {
    return selectedOptionComponent(() => this.roleOptions);
  }

  setRoleId = (option: unknown) => {
    const value = (option as RoleOption | null)?.value;
    this.args.changeset.set('roleId', value);
  };

  onSubmit = async (
    data: ValidatedUser | UpdatedUser,
    c: ImmerChangeset<ValidatedUser | UpdatedUser>
  ) => {
    await this.handleSave.handleSave({
      saveAction: () => this.user.save(data),
      changeset: c,
      successMessage: 'users.forms.user.messages.saveSuccess',
      transitionOnSuccess: 'dashboard.users',
    });
  };

  <template>
    <h1 class="text-2xl font-semibold mb-4" data-test-users-form-title>
      {{if
        this.isCreate
        (t "users.forms.user.titles.create")
        (t "users.forms.user.titles.edit")
      }}
    </h1>
    <TpkForm
      @changeset={{@changeset}}
      @onSubmit={{this.onSubmit}}
      @validationSchema={{@validationSchema}}
      data-test-users-form
      as |F|
    >
      <div class="flex flex-col gap-4 max-w-5xl">
        <div class="flex flex-wrap gap-4">
          <F.TpkInputPrefab
            @label={{t "users.forms.user.labels.firstName"}}
            @validationField="firstName"
            class="flex-1 min-w-[180px]"
          />
          <F.TpkInputPrefab
            @label={{t "users.forms.user.labels.lastName"}}
            @validationField="lastName"
            class="flex-1 min-w-[180px]"
          />
          {{#if this.isCreate}}
            <F.TpkPasswordPrefab
              @label={{t "users.forms.user.labels.password"}}
              @validationField="password"
              class="flex-1 min-w-[180px]"
            />
          {{/if}}
          <F.TpkEmailPrefab
            @label={{t "users.forms.user.labels.email"}}
            @validationField="email"
            class="flex-1 min-w-[180px]"
          />
          {{#if this.canAssignRole}}
            <F.TpkSelectPrefab
              @label={{t "users.forms.user.labels.role"}}
              @validationField="roleId"
              @options={{this.roleOptions}}
              @onChange={{this.setRoleId}}
              @selectedItemComponent={{this.roleSelectedItemComponent}}
              @placeholder={{t "users.forms.user.placeholders.select"}}
              class="flex-1 min-w-[180px]"
              data-test-role-select
            />
          {{/if}}
        </div>
        <div class="flex items-center justify-between gap-2">
          <button type="submit" class="btn btn-primary">
            {{t "users.forms.user.actions.submit"}}
          </button>
          <LinkTo
            @route="dashboard.users"
            class="text-sm text-primary underline text-center mt-2 inline-flex items-center gap-1"
          >
            <ArrowLeftIcon class="size-4" />
            {{t "users.forms.user.actions.back"}}
          </LinkTo>
        </div>
      </div>
    </TpkForm>
  </template>
}

export const pageObject = create({
  scope: '[data-test-users-form]',
  firstName: fillable(
    '[data-test-tpk-prefab-input-container="firstName"] input'
  ),
  lastName: fillable('[data-test-tpk-prefab-input-container="lastName"] input'),
  email: fillable('[data-test-tpk-prefab-email-container="email"] input'),
  password: fillable(
    '[data-test-tpk-prefab-password-container="password"] input'
  ),
  isPasswordVisible: isPresent(
    '[data-test-tpk-prefab-password-container="password"] input'
  ),
  submit: clickable('button[type="submit"]'),
});
