/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, test, vi } from 'vitest';
import {
  requireAbilityOrRedirect,
  type Services,
} from '../../src/utils/require-ability-or-redirect.ts';

function fakeServices(canResult: boolean): Services {
  return {
    ability: { can: vi.fn().mockReturnValue(canResult) },
    router: { transitionTo: vi.fn() },
    flashMessages: { danger: vi.fn() },
    intl: {
      exists: vi.fn().mockReturnValue(false),
      t: vi.fn().mockReturnValue('translated'),
    },
  } as unknown as Services;
}

describe('Util | requireAbilityOrRedirect', () => {
  test('does nothing when the ability grants the action/subject', () => {
    const services = fakeServices(true);

    const result = requireAbilityOrRedirect('manage', 'User', services);

    expect(result).toBeUndefined();
    expect(services.ability.can).toHaveBeenCalledWith('manage', 'User');
    expect(services.router.transitionTo).not.toHaveBeenCalled();
    expect(services.flashMessages.danger).not.toHaveBeenCalled();
  });

  test('flashes a danger message and redirects when the ability denies the action/subject', () => {
    const services = fakeServices(false);

    requireAbilityOrRedirect('manage', 'User', services);

    expect(services.flashMessages.danger).toHaveBeenCalledWith('translated');
    expect(services.router.transitionTo).toHaveBeenCalledWith('dashboard');
  });

  test('redirects to the custom route when provided', () => {
    const services = fakeServices(false);

    requireAbilityOrRedirect('manage', 'Role', services, 'dashboard.roles');

    expect(services.router.transitionTo).toHaveBeenCalledWith(
      'dashboard.roles'
    );
  });
});
