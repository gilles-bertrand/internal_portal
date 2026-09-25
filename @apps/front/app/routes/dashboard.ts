import Route from '@ember/routing/route';
import type RouterService from '@ember/routing/router-service';
import type Transition from '@ember/routing/transition';
import { service } from '@ember/service';
import type SessionService from 'ember-simple-auth/services/session';
import type FeaturesService from '@libs/shared-front/services/features';

export default class DashboardIndexRoute extends Route {
  @service declare session: SessionService;
  @service declare router: RouterService;
  @service declare features: FeaturesService;

  // @lat: [[apps/front-integration#Domaines montés : chargés avant le menu]]
  //
  // Les domaines montés sont chargés ICI, et attendus, parce que le menu de
  // `templates/dashboard.gts` les lit au rendu : résoudre après coup ferait
  // apparaître puis disparaître des entrées sous le curseur.
  //
  // Le service ne rejette jamais — un échec réseau laisse tous les domaines
  // considérés actifs — donc cet `await` ne peut pas empêcher l'accès au
  // tableau de bord.
  async beforeModel(t: Transition) {
    this.session.requireAuthentication(t, 'login');
    await this.features.load();
  }
}
