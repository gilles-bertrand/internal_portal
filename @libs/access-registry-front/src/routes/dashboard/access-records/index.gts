import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import type AbilityService from '@libs/shared-front/services/ability';
import { requireAbilityOrRedirect } from '@libs/shared-front/utils/require-ability-or-redirect';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';
import type ReferentialsService from '#src/services/referentials.ts';

export default class AccessRecordsIndexRoute extends Route {
  @service declare ability: AbilityService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;
  @service declare referentials: ReferentialsService;

  beforeModel() {
    return requireAbilityOrRedirect('read', 'AccessRecord', {
      ability: this.ability,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }

  // Les cellules purpose / sourceSystem du tableau retraduisent les codes
  // persistés en libellés : les référentiels doivent être en cache avant le
  // rendu, sinon la première peinture affiche les codes bruts.
  model() {
    return this.referentials.load();
  }
}
