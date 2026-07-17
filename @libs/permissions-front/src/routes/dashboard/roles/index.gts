import type { Role } from '#src/schemas/roles.ts';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type { Store } from '@warp-drive/core';
import { query } from '@warp-drive/utilities/json-api';
import type RouterService from '@ember/routing/router-service';
import type AbilityService from '@libs/shared-front/services/ability';
import { requireAbilityOrRedirect } from '@libs/shared-front/utils/require-ability-or-redirect';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';

export type RolesIndexRouteSignature = {
  model: Awaited<ReturnType<RolesIndexRoute['model']>>;
  controller: undefined;
};

export default class RolesIndexRoute extends Route {
  @service declare store: Store;
  @service declare ability: AbilityService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  // @lat: [[backend/permissions#Redirection bloquante dans beforeModel]]
  beforeModel() {
    return requireAbilityOrRedirect('manage', 'Role', {
      ability: this.ability,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }

  async model() {
    const response = await this.store.request(query<Role>('roles', {}));
    return { roles: response.content.data ?? [] };
  }
}
