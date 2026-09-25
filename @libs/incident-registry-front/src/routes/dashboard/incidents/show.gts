import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import type { Store } from '@warp-drive/core';
import type { ReactiveDataDocument } from '@warp-drive/core/reactive';
import { findRecord } from '@warp-drive/utilities/json-api';
import type AbilityService from '@libs/shared-front/services/ability';
import { requireAbilityOrRedirect } from '@libs/shared-front/utils/require-ability-or-redirect';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';
import type { Incident } from '#src/schemas/incidents.ts';

export default class IncidentsShowRoute extends Route {
  @service declare store: Store;
  @service declare ability: AbilityService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  beforeModel() {
    return requireAbilityOrRedirect('read', 'Incident', {
      ability: this.ability,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }

  async model(params: { incident_id: string }) {
    const result = await this.store.request<ReactiveDataDocument<Incident>>(
      findRecord<Incident>('incidents', params.incident_id)
    );
    return result.content.data;
  }
}
