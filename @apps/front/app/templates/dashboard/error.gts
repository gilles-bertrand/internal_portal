import Component from '@glimmer/component';
import { service } from '@ember/service';
import { LinkTo } from '@ember/routing';
import { t } from 'ember-intl';
import type { IntlService } from 'ember-intl';
import {
  resolveJsonApiErrorMessage,
  genericJsonApiErrorMessage,
  type JsonApiError,
} from '@libs/shared-front/utils/json-api-error-message';

interface DashboardErrorSignature {
  Args: {
    model: unknown;
  };
}

// @lat: [[frontend/shared-front#Substate d'erreur dashboard/error]]
export default class DashboardErrorTemplate extends Component<DashboardErrorSignature> {
  @service declare intl: IntlService;

  private get jsonApiError(): JsonApiError | undefined {
    const error = this.args.model as { errors?: JsonApiError[] } | undefined;
    return Array.isArray(error?.errors) ? error.errors[0] : undefined;
  }

  get title(): string {
    const status = this.jsonApiError?.status;
    if (status === '403') return this.intl.t('shared.error-page.titles.403');
    if (status === '404') return this.intl.t('shared.error-page.titles.404');
    return this.intl.t('shared.error-page.titles.generic');
  }

  get message(): string {
    const error = this.jsonApiError;
    return error
      ? resolveJsonApiErrorMessage(error, this.intl)
      : genericJsonApiErrorMessage(this.intl);
  }

  <template>
    <div
      class="flex flex-col items-center justify-center gap-4 py-16"
      data-test-dashboard-error
    >
      <h1 class="text-2xl font-semibold">{{this.title}}</h1>
      <p class="text-sm text-base-content/70">{{this.message}}</p>
      <LinkTo @route="dashboard" class="btn btn-primary">
        {{t "shared.error-page.backToDashboard"}}
      </LinkTo>
    </div>
  </template>
}
