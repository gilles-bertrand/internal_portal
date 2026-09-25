import { describe, expect, it, vi } from 'vitest';
import { requireFeatureOrRedirect } from '#src/utils/require-feature-or-redirect.ts';
import type FeaturesService from '#src/services/features.ts';

function services(enabled: boolean | 'unknown') {
  const transitionTo = vi.fn(() => 'transition');
  const info = vi.fn();
  const danger = vi.fn();
  return {
    spies: { transitionTo, info, danger },
    args: {
      features: {
        isEnabled: () => (enabled === 'unknown' ? true : enabled),
      } as unknown as FeaturesService,
      router: { transitionTo } as never,
      flashMessages: { info, danger } as never,
      intl: { t: (key: string) => key } as never,
    },
  };
}

describe('requireFeatureOrRedirect', () => {
  it('laisse passer un domaine monté', () => {
    const { spies, args } = services(true);

    expect(requireFeatureOrRedirect('incidentRegistry', args)).toBeUndefined();
    expect(spies.transitionTo).not.toHaveBeenCalled();
  });

  // La transition DOIT être retournée : sans cela Ember n'abandonne pas la
  // transition courante et `model()` s'exécute quand même — le piège déjà
  // documenté pour les gardes d'ability.
  it('retourne la transition pour abandonner la navigation', () => {
    const { spies, args } = services(false);

    expect(requireFeatureOrRedirect('incidentRegistry', args)).toBe(
      'transition'
    );
    expect(spies.transitionTo).toHaveBeenCalledWith('dashboard');
  });

  // LE POINT DE CONCEPTION. Un domaine coupé n'est pas un refus de droit :
  // annoncer « vous n'avez pas les droits nécessaires » affirmerait que la
  // fonctionnalité existe et vous est refusée, et enverrait l'utilisateur
  // réclamer à son administrateur un droit que personne ne peut lui donner.
  it("n'annonce pas un refus de droit, mais une absence", () => {
    const { spies, args } = services(false);
    requireFeatureOrRedirect('incidentRegistry', args);

    expect(spies.danger).not.toHaveBeenCalled();
    expect(spies.info).toHaveBeenCalledWith('shared.features.unavailable');
  });

  it('accepte une destination de repli explicite', () => {
    const { spies, args } = services(false);
    requireFeatureOrRedirect('todos', args, 'dashboard.access-records');

    expect(spies.transitionTo).toHaveBeenCalledWith('dashboard.access-records');
  });
});
