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
import type { Incident } from '#src/schemas/incidents.ts';

export type IncidentsEditRouteSignature = {
  model: Awaited<ReturnType<IncidentsEditRoute['model']>>;
  controller: undefined;
};

export default class IncidentsEditRoute extends Route {
  @service declare store: Store;
  @service declare ability: AbilityService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  beforeModel() {
    return requireAbilityOrRedirect('update', 'Incident', {
      ability: this.ability,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }

  async model({ incident_id }: { incident_id: string }) {
    const incident = await this.store.request(
      findRecord<Incident>('incidents', incident_id, { include: [] })
    );

    assert('Incident must not be null', incident.content.data !== null);

    return { incident: incident.content.data };
  }
}
