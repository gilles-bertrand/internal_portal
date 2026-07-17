import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import type { Store } from '@warp-drive/core';
import type { ReactiveDataDocument } from '@warp-drive/core/reactive';
import { query } from '@warp-drive/utilities/json-api';
import type AbilityService from '@libs/shared-front/services/ability';
import { requireAbilityOrRedirect } from '@libs/shared-front/utils/require-ability-or-redirect';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';
import type { Purpose } from '#src/schemas/purposes.ts';
import type { LegalBasis } from '#src/schemas/legal-bases.ts';
import type { DataCategory } from '#src/schemas/data-categories.ts';

export type AccessRecordsCreateRouteSignature = {
  model: Awaited<ReturnType<AccessRecordsCreateRoute['model']>>;
  controller: undefined;
};

export default class AccessRecordsCreateRoute extends Route {
  @service declare store: Store;
  @service declare ability: AbilityService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  beforeModel() {
    return requireAbilityOrRedirect('create', 'AccessRecord', {
      ability: this.ability,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }

  // legalBasis/dataCategories/purpose are select fields backed by backend
  // referentials (see [[frontend/access-record-options#Référentiels dynamiques vs enum statique]]),
  // fetched once here rather than inside the form component so the form stays
  // a pure presentational component driven by @args.
  async model() {
    const [purposes, legalBases, dataCategories] = await Promise.all([
      this.store.request<ReactiveDataDocument<Purpose[]>>(
        query<Purpose>('purposes')
      ),
      this.store.request<ReactiveDataDocument<LegalBasis[]>>(
        query<LegalBasis>('legal-bases')
      ),
      this.store.request<ReactiveDataDocument<DataCategory[]>>(
        query<DataCategory>('data-categories')
      ),
    ]);
    return {
      purposes: purposes.content.data,
      legalBases: legalBases.content.data,
      dataCategories: dataCategories.content.data,
    };
  }
}
