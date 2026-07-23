# Stratégie de bout en bout Playwright

E2E Playwright contre le vrai backend (pas de mocks MSW), avec environnement Docker Postgres auto-démarré et seed dédié.

`@apps/e2e/playwright.config.ts` démarre deux serveurs en parallèle : le backend réel en mode e2e (healthcheck sur `/api/v1/status`) et le front buildé en mode e2e avec `VITE_MOCK_API=false` — ce flag désactive les mocks MSW vus dans [[front-integration#Intégration des libs *-front dans l'app hôte]]. C'est le lien concret entre le flag MSW du front et l'environnement e2e.

[[@apps/e2e/scripts/setup.ts#setupDatabase]] vérifie Docker, démarre Postgres si absent, attend `pg_isready`, puis déclenche `schema:fresh --seed E2ESeeder --run` côté backend — nécessite les secrets e2e déchiffrés au préalable ([[backend-bootstrap#Secrets et seeding déterministe]]).

Couverture actuelle : parcours de connexion, navigation vers le registre incidents via un lien de sidebar, ouverture du formulaire de création incident, et le comportement observable des permissions CASL décrit ci-dessous. Ces deux derniers dépendaient du câblage sidebar/router/module backend documenté dans [[front-integration]] et [[backend-bootstrap#Assemblage incident-registry (module désormais branché)]] — désormais en place, ce parcours devrait fonctionner. Le README `@apps/e2e/README.md` est partiellement obsolète (mentionne un spec inexistant) — se fier au contenu réel de `tests/` plutôt qu'au README.

[[@apps/backend/src/seeders/e2e.seeder.ts#E2ESeeder]] seed désormais les 4 rôles (`encoder`, `dpo`, `auditor`, `tech_admin`) avec les mêmes `PermissionRuleEntity` que [[backend/permissions#Seed des 4 rôles avec permissions équivalentes au comportement actuel]] — mirroir intentionnel plutôt que mutualisation, pour ne pas risquer de régression sur le seeder dev déjà testé. Un utilisateur e2e dédié est créé par rôle supplémentaire (`dpo-e2e@triptyk.eu`, `auditor-e2e@triptyk.eu`, `tech-admin-e2e@triptyk.eu`, mot de passe `123456789`), en plus des users encoder existants.

## Permissions CASL

`@apps/e2e/tests/permissions.spec.ts` verrouille le comportement utilisateur observable des correctifs de permissions CASL sur les registres AccessRecord/Incident, en plus de la couverture unitaire/intégration/acceptance déjà existante.

### tech_admin accède au registre d'accès

Connecté en tech_admin, le registre d'accès est accessible sur les couches front et back — tech_admin possède `read AccessRecord` ([[backend/permissions#Seed des 4 rôles avec permissions équivalentes au comportement actuel]]).

Le lien sidebar "Access registry" est visible et mène à la page (deep link direct compris, sans redirection), et l'API `GET /api/v1/access-records` répond 200 avec le vrai jeton. L'accès étant en **lecture seule**, le bouton de création est masqué et la route `/access-records/create` redirige vers la home. Le rejet 403 de la création côté API (par rôle) est couvert par la matrice d'intégration backend (avec payload valide).

### tech_admin reste banni des incidents (3 couches)

Le registre des incidents reste interdit à tech_admin, vérifié sur les 3 couches.

Lien sidebar "Incident registry" absent, navigation directe vers `/incidents` redirigée vers `/`, et appel API direct `GET /api/v1/incidents` rejeté en 403 même avec un jeton valide — la garde serveur est obligatoire indépendamment de l'UI.

### encoder voit et accède à Access Records

Connecté en encoder (`deflorenne.amaury@triptyk.eu`), le lien sidebar "Access registry" est visible et la navigation mène à la page listant le registre — l'équivalent pour Incidents est déjà couvert par `incidents.spec.ts`, donc non dupliqué ici.
