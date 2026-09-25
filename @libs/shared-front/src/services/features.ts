import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

// État des domaines montés par le serveur.
//
// LE FRONT NE TIENT PAS SA PROPRE LISTE. Elle est lue sur `GET /api/v1/status`,
// qui est la seule autorité : un domaine désactivé n'a plus de routes côté API,
// et une liste locale — variable de build du front, constante en dur — finirait
// par ne plus correspondre. Un déploiement qui coupe un domaine sans rebuild du
// front laisserait alors une entrée de menu menant à des 404.
//
// C'est le même défaut que deux jeux de champs canoniques tenus en parallèle :
// deux listes qui ne s'accordent que par discipline finissent par diverger.
//
// @lat: [[frontend/shared-front#Domaines montés : lus du serveur, jamais redéclarés]]
export default class FeaturesService extends Service {
  // Undefined tant que la réponse n'est pas arrivée — volontairement distinct de
  // « tout désactivé » : voir `isEnabled`.
  @tracked private state: Record<string, boolean> | undefined;

  @tracked loaded = false;

  /**
   * Charge l'état des domaines. Idempotent, à appeler une fois au démarrage.
   *
   * Un échec réseau n'est PAS traité comme « tout est coupé » : on préfère un
   * menu complet dont une entrée mènerait à une erreur, plutôt qu'une interface
   * amputée sans que personne ne l'ait décidé. L'accident doit aller vers
   * « trop visible », jamais vers « registre invisible ».
   */
  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    try {
      const response = await fetch('/api/v1/status');
      if (response.ok) {
        const body = (await response.json()) as {
          features?: Record<string, boolean>;
        };
        this.state = body.features;
      }
    } catch {
      // état laissé undefined : `isEnabled` répondra true
    } finally {
      this.loaded = true;
    }
  }

  /**
   * Un domaine est considéré actif tant que le serveur n'a pas dit le contraire.
   *
   * Seul un `false` explicite masque quelque chose : ni l'absence de réponse, ni
   * une clé inconnue. Cette asymétrie est la même que celle du schéma
   * d'environnement côté backend, et pour la même raison.
   */
  isEnabled(name: string): boolean {
    return this.state?.[name] !== false;
  }
}
