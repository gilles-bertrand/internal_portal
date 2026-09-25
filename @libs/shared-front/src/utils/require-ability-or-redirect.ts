import type RouterService from '@ember/routing/router-service';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';
import type AbilityService from '../services/ability.ts';
import { resolveJsonApiErrorMessage } from './json-api-error-message.ts';

export interface Services {
  ability: AbilityService;
  router: RouterService;
  flashMessages: FlashMessageService;
  intl: IntlService;
}

// @lat: [[backend/permissions#Redirection bloquante dans beforeModel]]
export function requireAbilityOrRedirect(
  action: string,
  subject: string,
  services: Services,
  redirectTo = 'dashboard'
) {
  if (services.ability.can(action, subject)) return undefined;

  services.flashMessages.danger(
    resolveJsonApiErrorMessage(
      { code: 'FORBIDDEN', status: '403' },
      services.intl
    )
  );
  return services.router.transitionTo(redirectTo);
}
