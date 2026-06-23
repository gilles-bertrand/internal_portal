import Component from '@glimmer/component';
import TpkForm from '@triptyk/ember-input-validation/components/tpk-form';
import { service } from '@ember/service';
import type AccessRecordService from '#src/services/access-record.ts';
import type { AccessRecordChangeset } from '#src/changesets/access-record.ts';
import {
  createAccessRecordValidationSchema,
  type ValidatedAccessRecord,
} from '#src/components/forms/access-record-validation.ts';
import type RouterService from '@ember/routing/router-service';
import { create, fillable, clickable } from 'ember-cli-page-object';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import { t, type IntlService } from 'ember-intl';
import { LinkTo } from '@ember/routing';
import type ImmerChangeset from 'ember-immer-changeset';
import HandleSaveService from '@libs/shared-front/services/handle-save';

interface AccessRecordFormArgs {
  changeset: AccessRecordChangeset;
  validationSchema: ReturnType<typeof createAccessRecordValidationSchema>;
}

export default class AccessRecordForm extends Component<AccessRecordFormArgs> {
  @service declare accessRecord: AccessRecordService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;
  @service declare handleSave: HandleSaveService;

  onSubmit = async (
    data: ValidatedAccessRecord,
    c: ImmerChangeset<ValidatedAccessRecord>
  ) => {
    await this.handleSave.handleSave({
      saveAction: () => this.accessRecord.create(data),
      changeset: c,
      successMessage: 'access-records.forms.accessRecord.messages.saveSuccess',
      transitionOnSuccess: 'dashboard.access-records',
    });
  };

  <template>
    <TpkForm
      @changeset={{@changeset}}
      @onSubmit={{this.onSubmit}}
      @validationSchema={{@validationSchema}}
      data-test-access-record-form
      as |F|
    >
      <div class="grid grid-cols-12 gap-x-6 gap-y-3 max-w-4xl">
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.accessedAt"}}
          @validationField="accessedAt"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.accessorRef"}}
          @validationField="accessorRef"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.dataSubjectRef"}}
          @validationField="dataSubjectRef"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.dataCategories"}}
          @validationField="dataCategories"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.accessType"}}
          @validationField="accessType"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.purpose"}}
          @validationField="purpose"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.legalBasis"}}
          @validationField="legalBasis"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.sourceSystem"}}
          @validationField="sourceSystem"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkInputPrefab
          @label={{t "access-records.forms.accessRecord.labels.recipient"}}
          @validationField="recipient"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkCheckboxPrefab
          @label={{t
            "access-records.forms.accessRecord.labels.isSpecialCategory"
          }}
          @validationField="isSpecialCategory"
          class="col-span-12 md:col-span-6"
        />
        <F.TpkTextareaPrefab
          @label={{t "access-records.forms.accessRecord.labels.justification"}}
          @validationField="justification"
          class="col-span-12"
        />
        <div class="col-span-12 flex items-center justify-between gap-2">
          <button type="submit" class="btn btn-primary">
            {{t "access-records.forms.accessRecord.actions.submit"}}
          </button>
          <LinkTo
            @route="dashboard.access-records"
            class="text-sm text-primary underline text-center mt-2"
          >
            {{t "access-records.forms.accessRecord.actions.back"}}
          </LinkTo>
        </div>
      </div>
    </TpkForm>
  </template>
}

export const pageObject = create({
  scope: '[data-test-access-record-form]',
  accessedAt: fillable(
    '[data-test-tpk-prefab-input-container="accessedAt"] input'
  ),
  accessorRef: fillable(
    '[data-test-tpk-prefab-input-container="accessorRef"] input'
  ),
  dataSubjectRef: fillable(
    '[data-test-tpk-prefab-input-container="dataSubjectRef"] input'
  ),
  dataCategories: fillable(
    '[data-test-tpk-prefab-input-container="dataCategories"] input'
  ),
  accessType: fillable(
    '[data-test-tpk-prefab-input-container="accessType"] input'
  ),
  purpose: fillable('[data-test-tpk-prefab-input-container="purpose"] input'),
  legalBasis: fillable(
    '[data-test-tpk-prefab-input-container="legalBasis"] input'
  ),
  sourceSystem: fillable(
    '[data-test-tpk-prefab-input-container="sourceSystem"] input'
  ),
  justification: fillable(
    '[data-test-tpk-prefab-textarea-container="justification"] textarea'
  ),
  submit: clickable('button[type="submit"]'),
});
