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
import type { AccessRecord } from '#src/schemas/access-records.ts';

export type AccessRecordsShowRouteSignature = {
  model: Awaited<ReturnType<AccessRecordsShowRoute['model']>>;
  controller: undefined;
};

export default class AccessRecordsShowRoute extends Route {
  @service declare store: Store;
  @service declare ability: AbilityService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  beforeModel() {
    return requireAbilityOrRedirect('read', 'AccessRecord', {
      ability: this.ability,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }

  // Le backend applique déjà la règle row-level (un encoder ne lit que ses
  // propres enregistrements) : une consultation non autorisée renvoie 403/404.
  async model(params: { access_record_id: string }) {
    const result = await this.store.request<ReactiveDataDocument<AccessRecord>>(
      findRecord<AccessRecord>('access-records', params.access_record_id)
    );
    return result.content.data;
  }
}
