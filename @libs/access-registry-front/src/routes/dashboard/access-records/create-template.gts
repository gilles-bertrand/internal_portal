import { AccessRecordChangeset } from '#src/changesets/access-record.ts';
import AccessRecordForm from '#src/components/forms/access-record-form.gts';
import Component from '@glimmer/component';
import type { AccessRecordsCreateRouteSignature } from './create.gts';
import type Owner from '@ember/owner';
import type { IntlService } from 'ember-intl';
import { service } from '@ember/service';
import { createAccessRecordValidationSchema } from '#src/components/forms/access-record-validation.ts';

export default class AccessRecordsCreateRouteTemplate extends Component<AccessRecordsCreateRouteSignature> {
  @service declare intl: IntlService;
  validationSchema: ReturnType<typeof createAccessRecordValidationSchema>;
  changeset = new AccessRecordChangeset({});

  constructor(owner: Owner, args: AccessRecordsCreateRouteSignature) {
    super(owner, args);
    this.validationSchema = createAccessRecordValidationSchema(this.intl);
  }

  <template>
    <AccessRecordForm
      @changeset={{this.changeset}}
      @validationSchema={{this.validationSchema}}
    />
  </template>
}
