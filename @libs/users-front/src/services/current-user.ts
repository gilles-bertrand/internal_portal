import type { User } from '#src/schemas/users.ts';
import Service from '@ember/service';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import type { Store } from '@warp-drive/core';
import { query } from '@warp-drive/utilities/json-api';
import type SessionService from 'ember-simple-auth/services/session';
import type { ReactiveDataDocument } from '@warp-drive/core/reactive';
import type AbilityService from '@libs/shared-front/services/ability';
import type { AbilityRule } from '@libs/shared-front/services/ability';
import type ErrorReporterService from '@libs/shared-front/services/error-reporter';
import { getAccessToken } from '#src/utils/access-token.ts';

// @lat: [[frontend/shared-front#Moteur de permissions front (AbilityService)]]
export default class CurrentUserService extends Service {
  @service declare store: Store;
  @service declare session: SessionService;
  @service declare ability: AbilityService;
  @service declare errorReporter: ErrorReporterService;
  @tracked user?: User;

  get currentUser(): User {
    if (!this.user) {
      throw new Error('No current user set');
    }

    return this.user;
  }

  async load() {
    if (!this.session.isAuthenticated) {
      this.user = undefined;
      this.ability.reset();
      return;
    }

    const response = await this.store.request<ReactiveDataDocument<User>>(
      query<User>(
        'users',
        {},
        {
          resourcePath: 'users/profile',
        }
      )
    );

    this.user = response.content.data;

    try {
      this.ability.load(await this.fetchMyAbilityRules());
    } catch (error) {
      // Un pépin réseau/serveur sur /me/ability ne doit pas faire échouer
      // tout le boot de l'app (ApplicationRoute#beforeModel n'a pas de
      // substate d'erreur au-dessus de lui) — on retombe sur une ability
      // vide (tout refusé) plutôt que de laisser l'exception se propager.
      this.errorReporter.report(error);
      this.ability.reset();
    }
  }

  // GET /me/ability ne modélise pas une ressource JSON:API (pas de type/id/
  // attributes) — un fetch direct évite d'enregistrer un schéma WarpDrive
  // pour un type qui n'en a pas besoin.
  private async fetchMyAbilityRules(): Promise<AbilityRule[]> {
    const accessToken = getAccessToken(this.session);
    const response = await fetch('/api/v1/me/ability', {
      headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
    });
    const body = (await response.json()) as { data: { rules: AbilityRule[] } };
    return body.data.rules;
  }
}
