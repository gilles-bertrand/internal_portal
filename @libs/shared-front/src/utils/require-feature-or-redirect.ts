import type RouterService from '@ember/routing/router-service';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';
import type FeaturesService from '../services/features.ts';

export interface FeatureGuardServices {
  features: FeaturesService;
  router: RouterService;
  flashMessages: FlashMessageService;
  intl: IntlService;
}

// Garde de route pour un domaine désactivé par drapeau.
//
// DÉLIBÉRÉMENT DISTINCT DE `requireAbilityOrRedirect`, et surtout de son
// message. Un domaine coupé n'est pas un refus de droit : dire « vous n'avez pas
// les droits nécessaires » affirmerait que la fonctionnalité existe et vous est
// refusée, là où la vérité est qu'elle n'est pas déployée. Dans un produit de
// conformité, cette nuance se lit — un utilisateur à qui l'on refuse un accès
// va demander ce droit à son administrateur, qui ne pourra rien lui donner.
//
// Le serveur reste l'autorité : un domaine non monté répond 404 quoi qu'il
// arrive. Ce garde évite seulement qu'une URL tapée à la main affiche une page
// dont tous les appels échouent.
//
// @lat: [[frontend/shared-front#Garde de route pour un domaine désactivé]]
export function requireFeatureOrRedirect(
  feature: string,
  services: FeatureGuardServices,
  redirectTo = 'dashboard'
) {
  if (services.features.isEnabled(feature)) return undefined;

  services.flashMessages.info(services.intl.t('shared.features.unavailable'));
  // @lat: [[backend/permissions#Redirection bloquante dans beforeModel]]
  // La transition DOIT être retournée, sinon Ember n'abandonne pas la
  // transition courante et `model()` s'exécute quand même.
  return services.router.transitionTo(redirectTo);
}
