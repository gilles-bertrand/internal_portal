import type { Role } from '#src/schemas/roles.ts';
import { assert } from '@ember/debug';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type { Store } from '@warp-drive/core';
import { findRecord } from '@warp-drive/utilities/json-api';
import type RouterService from '@ember/routing/router-service';
import type AbilityService from '@libs/shared-front/services/ability';
import { requireAbilityOrRedirect } from '@libs/shared-front/utils/require-ability-or-redirect';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';

export type RolesEditRouteSignature = {
  model: Awaited<ReturnType<RolesEditRoute['model']>>;
  controller: undefined;
};

export default class RolesEditRoute extends Route {
  @service declare store: Store;
  @service declare ability: AbilityService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  beforeModel() {
    return requireAbilityOrRedirect('manage', 'Role', {
      ability: this.ability,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }

  async model({ role_id }: { role_id: string }) {
    const response = await this.store.request(
      findRecord<Role>('roles', role_id, { include: [] })
    );

    assert('Role must not be null', response.content.data !== null);

    return { role: response.content.data };
  }
}
