import Component from '@glimmer/component';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { t, type IntlService } from 'ember-intl';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type RoleService from '#src/services/role.ts';
import type { PermissionRule } from '#src/schemas/roles.ts';

// @lat: [[backend/permissions#Édition de la matrice de permissions]]
const SUBJECTS = [
  'User',
  'Role',
  'AccessRecord',
  'Incident',
  'AccessRecordIntegrity',
  'AccessRecordRetention',
  'IncidentIntegrity',
] as const;

const ACTIONS = ['create', 'read', 'update', 'delete', 'manage'] as const;

interface RolePermissionMatrixArgs {
  roleId: string;
  rules: PermissionRule[];
}

interface RolePermissionMatrixSignature {
  Args: RolePermissionMatrixArgs;
}

export default class RolePermissionMatrix extends Component<RolePermissionMatrixSignature> {
  @service declare role: RoleService;
  @service declare intl: IntlService;
  @service declare flashMessages: FlashMessageService;

  @tracked rules: PermissionRule[] = this.args.rules.filter((r) => !r.inverted);
  preservedInvertedRules: PermissionRule[] = this.args.rules.filter(
    (r) => r.inverted
  );
  @tracked saving = false;

  subjects = SUBJECTS;
  actions = ACTIONS;

  isChecked = (subject: string, action: string): boolean => {
    return this.rules.some((r) => r.subject === subject && r.action === action);
  };

  toggle = (subject: string, action: string) => {
    if (this.isChecked(subject, action)) {
      this.rules = this.rules.filter(
        (r) => !(r.subject === subject && r.action === action)
      );
    } else {
      this.rules = [
        ...this.rules,
        {
          subject,
          action,
          conditions: null,
          fields: null,
          inverted: false,
          order: 0,
        },
      ];
    }
    void this.persist();
  };

  private async persist() {
    this.saving = true;
    try {
      await this.role.updateRules(this.args.roleId, [
        ...this.rules,
        ...this.preservedInvertedRules,
      ]);
      this.flashMessages.success(
        this.intl.t('permissions.forms.role.messages.permissionsSaved')
      );
    } catch {
      this.flashMessages.danger(
        this.intl.t('permissions.forms.role.messages.permissionsError')
      );
    } finally {
      this.saving = false;
    }
  }

  <template>
    <div data-test-role-permission-matrix>
      <p class="text-sm text-gray-500 mb-4">
        {{t "permissions.forms.role.matrix.advancedRulesNotice"}}
      </p>
      <table class="table-auto w-full text-sm">
        <thead>
          <tr>
            <th class="text-left p-2"></th>
            {{#each this.actions as |columnAction|}}
              <th class="text-center p-2">{{columnAction}}</th>
            {{/each}}
          </tr>
        </thead>
        <tbody>
          {{#each this.subjects as |subject|}}
            <tr data-test-role-permission-row={{subject}}>
              <td class="p-2 font-medium">{{subject}}</td>
              {{#each this.actions as |rowAction|}}
                <td class="text-center p-2">
                  <input
                    type="checkbox"
                    aria-label="{{rowAction}} {{subject}}"
                    data-test-role-permission-checkbox="{{subject}}:{{rowAction}}"
                    checked={{this.isChecked subject rowAction}}
                    disabled={{this.saving}}
                    {{on "change" (fn this.toggle subject rowAction)}}
                  />
                </td>
              {{/each}}
            </tr>
          {{/each}}
        </tbody>
      </table>
    </div>
  </template>
}
