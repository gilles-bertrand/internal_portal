import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import type AbilityService from '@libs/shared-front/services/ability';
import { requireAbilityOrRedirect } from '@libs/shared-front/utils/require-ability-or-redirect';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';
import type { Store } from '@warp-drive/core';
import { query } from '@warp-drive/utilities/json-api';
import type { RoleSummary } from '#src/utils/role-summary.ts';

export type UsersCreateRouteSignature = {
  model: Awaited<ReturnType<UsersCreateRoute['model']>>;
  controller: undefined;
};

export default class UsersCreateRoute extends Route {
  @service declare ability: AbilityService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;
  @service declare store: Store;

  beforeModel() {
    return requireAbilityOrRedirect('manage', 'User', {
      ability: this.ability,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }

  async model() {
    const response = await this.store.request(
      query('roles', {}, { resourcePath: 'users/role-options' })
    );
    return { roles: (response.content.data ?? []) as unknown as RoleSummary[] };
  }
}
