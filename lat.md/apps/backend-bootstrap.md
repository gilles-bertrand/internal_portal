# Bootstrap et assemblage des modules backend

Composition root explicite et sans framework DI : [[@apps/backend/src/configuration.ts#loadConfiguration]] (validation Zod stricte de l'environnement) → [[@apps/backend/src/app/application.context.ts#createApplicationContext]] → [[@apps/backend/src/app/app.ts#App]] qui instancie et branche chaque module `*-backend` à la main.

`loadConfiguration` valide `process.env` avec un schéma Zod unique ; en cas d'échec, l'erreur liste précisément quelles variables manquent vs sont invalides. `createApplicationContext` construit un objet `{configuration, logger, orm}` unique injecté partout — pas de DI framework, juste un objet de contexte passé explicitement. `App` enregistre les plugins Fastify dans un ordre figé (session sécurisée + passport, puis CORS, swagger, fichiers statiques) puis instancie chaque module avec un EntityManager forké (`orm.em.fork()`) par module, cf. [[platform#Contrat de module Fastify partagé]].

## Assemblage incident-registry (module désormais branché)

`@libs/incident-registry-backend` est maintenant instancié dans `App.setupRoutes` et enregistré dans [[platform#Contrat de module Fastify partagé|appRouter]] via `incidentRegistryModule`.

`IncidentRegistryModule.init(...)` prend la même forme que `AccessRegistryModule` : `em` forké + `configuration.{jwtSecret,exportSigningKey}` + une instance `AuditAppendService`.

Historique : ses entités étaient déjà enregistrées dans [[@apps/backend/src/app/database.connection.ts#databaseConfig]] (nécessaire pour que le seeder de dev fonctionne, cf. [[incident-registry#Champs texte long : p.text() requis pour legalContext/description/conclusion]]), mais le module Fastify lui-même ne l'était pas — la route HTTP `/incidents` n'existait donc pas malgré un schéma DB fonctionnel et un code de route complet. Symétrique au branchement frontend, cf. [[front-integration]].

## Secrets et seeding déterministe

Secrets chiffrés SOPS + age (`.env.enc`/`.env.e2e.enc` versionnés), déchiffrés par `scripts/dev-setup.mjs` avec écriture atomique tmp+mv.

`mikro-orm.config.ts` fixe une seed déterministe (`@ngneat/falso`) pour la reproductibilité des données générées.

`seedersList` ([[@apps/backend/src/app/database.connection.ts#databaseConfig]]) enregistre explicitement [[@apps/backend/src/seeders/development.seeder.ts#DatabaseSeeder]] et [[@apps/backend/src/seeders/e2e.seeder.ts#E2ESeeder]] par référence plutôt que par scan disque — la découverte par glob de MikroORM échouait sous vite-node en CI. `E2ESeeder` (utilisateurs seulement) et `DatabaseSeeder` (référentiels RGPD + incidents de démo) sont deux jeux de données volontairement distincts.
