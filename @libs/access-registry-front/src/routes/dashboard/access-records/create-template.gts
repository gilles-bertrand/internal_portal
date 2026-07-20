import { AccessRecordChangeset } from '#src/changesets/access-record.ts';
import AccessRecordForm from '#src/components/forms/access-record-form.gts';
import Component from '@glimmer/component';
import type { AccessRecordsCreateRouteSignature } from './create.gts';
import type Owner from '@ember/owner';
import type { IntlService } from 'ember-intl';
import { service } from '@ember/service';
import { createAccessRecordValidationSchema } from '#src/components/forms/access-record-validation.ts';
import type CurrentUserService from '@libs/users-front/services/current-user';

export default class AccessRecordsCreateRouteTemplate extends Component<AccessRecordsCreateRouteSignature> {
  @service declare intl: IntlService;
  @service declare currentUser: CurrentUserService;
  validationSchema: ReturnType<typeof createAccessRecordValidationSchema>;
  // accessedAt must be null (not undefined) so TpkDatepicker accepts the value.
  // accessorRef defaults to the current user's display name: the accessor is
  // usually the encoder, but the select stays editable to cover accessor ≠ encoder.
  changeset: AccessRecordChangeset;

  constructor(owner: Owner, args: AccessRecordsCreateRouteSignature) {
    super(owner, args);
    this.validationSchema = createAccessRecordValidationSchema(this.intl);
    this.changeset = new AccessRecordChangeset({
      accessedAt: null,
      accessorRef: this.defaultAccessorName,
    });
  }

  private get defaultAccessorName(): string {
    const user = this.currentUser.user;
    if (!user) {
      return '';
    }
    return `${user.firstName} ${user.lastName}`.trim();
  }

  <template>
    <AccessRecordForm
      @changeset={{this.changeset}}
      @validationSchema={{this.validationSchema}}
      @purposes={{@model.purposes}}
      @legalBases={{@model.legalBases}}
      @dataCategories={{@model.dataCategories}}
      @sourceSystems={{@model.sourceSystems}}
      @eligibleAccessors={{@model.eligibleAccessors}}
    />
  </template>
}
