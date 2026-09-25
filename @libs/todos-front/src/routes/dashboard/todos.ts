import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import type FeaturesService from '@libs/shared-front/services/features';
import { requireFeatureOrRedirect } from '@libs/shared-front/utils/require-feature-or-redirect';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';

// Garde de domaine, posé sur la route PARENTE : il couvre d'un coup toutes les
// routes filles (index, create, edit), là où un garde par route se serait
// oublié sur la prochaine.
//
// Le serveur reste l'autorité — un domaine non monté répond 404 — ceci évite
// seulement qu'une URL tapée à la main affiche une page dont chaque appel échoue.
//
// @lat: [[frontend/shared-front#Garde de route pour un domaine désactivé]]
export default class TodosDomainRoute extends Route {
  @service declare features: FeaturesService;
  @service declare router: RouterService;
  @service declare flashMessages: FlashMessageService;
  @service declare intl: IntlService;

  beforeModel() {
    return requireFeatureOrRedirect('todos', {
      features: this.features,
      router: this.router,
      flashMessages: this.flashMessages,
      intl: this.intl,
    });
  }
}
