import type { User } from '#src/schemas/users.ts';
import { assert } from '@ember/debug';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type { Store } from '@warp-drive/core';
import { findRecord, query } from '@warp-drive/utilities/json-api';
import type RouterService from '@ember/routing/router-service';
import type AbilityService from '@libs/shared-front/services/ability';
import { requireAbilityOrRedirect } from '@libs/shared-front/utils/require-ability-or-redirect';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';
import type { RoleSummary } from '#src/utils/role-summary.ts';

export type UsersEditRouteSignature = {
  model: Awaited<ReturnType<UsersEditRoute['model']>>;
  controller: undefined;
};

export default class UsersEditRoute extends Route {
  @service declare store: Store;
  @service declare ability: AbilityService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  beforeModel() {
    return requireAbilityOrRedirect('manage', 'User', {
      ability: this.ability,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }

  async model({ user_id }: { user_id: string }) {
    const [user, rolesResponse] = await Promise.all([
      this.store.request(
        findRecord<User>('users', user_id, {
          include: [],
        })
      ),
      this.store.request(
        query('roles', {}, { resourcePath: 'users/role-options' })
      ),
    ]);

    assert('User must not be null', user.content.data !== null);

    return {
      user: user.content.data,
      roles: (rolesResponse.content.data ?? []) as unknown as RoleSummary[],
    };
  }
}
