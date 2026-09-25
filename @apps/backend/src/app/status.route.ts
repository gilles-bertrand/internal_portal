import { boolean, object, record, string } from "zod";
import type { FastifyInstanceType } from "./app.js";
import { FEATURE_NAMES, type FeatureName } from "#src/configuration.js";

// Route publique : elle sert de sonde de santé ET de source unique des drapeaux
// de fonctionnalité pour le front.
//
// POURQUOI LE FRONT NE DÉCLARE PAS SA PROPRE LISTE. Une seconde liste de
// domaines, alimentée par les variables de build du front, s'accorderait avec
// celle du serveur par pure discipline : le jour où un déploiement pose
// `FEATURE_X=false` côté API sans rebuild du front, le menu proposerait une
// fonctionnalité dont les routes n'existent plus, et l'utilisateur tomberait sur
// des 404. C'est exactement le défaut que le versionnage des champs canoniques
// a dû corriger côté hash — deux listes indépendantes, aucun test entre elles.
// Ici le serveur est la seule autorité, et le front la consulte.
//
// Aucune authentification : la liste des domaines montés est déjà déductible
// des routes servies, elle ne révèle rien de plus, et le front en a besoin avant
// même l'écran de connexion.
//
// @lat: [[apps/backend-bootstrap#Drapeaux de fonctionnalité par domaine]]
export function statusRoute(
  fastify: FastifyInstanceType,
  options: { features: Record<FeatureName, boolean> },
) {
  return fastify.get(
    "/status",
    {
      schema: {
        response: {
          200: object({
            status: string().includes("ok"),
            features: record(string(), boolean()),
          }),
        },
      },
    },
    async (_, reply) => {
      reply.send({
        status: "ok",
        // Réénumérées depuis FEATURE_NAMES plutôt que renvoyées telles quelles :
        // la réponse porte ainsi TOUJOURS les mêmes clés, y compris celles
        // laissées à leur valeur par défaut. Un front qui lit `features.todos`
        // ne doit jamais recevoir `undefined` et l'interpréter comme `false`.
        features: Object.fromEntries(
          FEATURE_NAMES.map((name) => [name, options.features[name] === true]),
        ),
      });
    },
  );
}
