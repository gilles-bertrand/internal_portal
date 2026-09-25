# Stratégie de bout en bout Playwright

E2E Playwright contre le vrai backend (pas de mocks MSW), avec environnement Docker Postgres auto-démarré et seed dédié.

`@apps/e2e/playwright.config.ts` démarre deux serveurs en parallèle : le backend réel en mode e2e (healthcheck sur `/api/v1/status`) et le front buildé en mode e2e avec `VITE_MOCK_API=false` — ce flag désactive les mocks MSW vus dans [[front-integration#Intégration des libs *-front dans l'app hôte]]. C'est le lien concret entre le flag MSW du front et l'environnement e2e.

[[@apps/e2e/scripts/docker-postgres.ts#ensurePostgresRunning]] vérifie Docker, démarre Postgres si absent et attend `pg_isready` ; [[@apps/e2e/scripts/docker-postgres.ts#setupE2EDatabase]] déclenche ensuite `schema:fresh --seed E2ESeeder --run` côté backend — nécessite les secrets e2e déchiffrés au préalable ([[backend-bootstrap#Secrets et seeding déterministe]]). `setup.ts` (setup complet) et `setup-db.ts` (base seule) ne sont que deux entrées sur ces mêmes fonctions. La sonde de disponibilité passe par le service `database` du docker-compose : filtrer sur `ancestor=postgres:<version>` cassait silencieusement à chaque montée de version de l'image.

Couverture actuelle : parcours de connexion, navigation vers le registre incidents via un lien de sidebar, ouverture du formulaire de création incident, et le comportement observable des permissions CASL décrit ci-dessous. Ces deux derniers dépendaient du câblage sidebar/router/module backend documenté dans [[front-integration]] et [[backend-bootstrap#Assemblage incident-registry (module désormais branché)]] — désormais en place, ce parcours devrait fonctionner. Le README `@apps/e2e/README.md` documente le mode d'emploi (setup, base dédiée, comptes seedés) ; la liste des specs qu'il donne doit être maintenue avec `tests/`.

[[@apps/backend/src/seeders/e2e.seeder.ts#E2ESeeder]] seed désormais les 4 rôles (`encoder`, `dpo`, `auditor`, `tech_admin`) avec les mêmes `PermissionRuleEntity` que [[backend/permissions#Seed des 4 rôles avec permissions équivalentes au comportement actuel]] — mirroir intentionnel plutôt que mutualisation, pour ne pas risquer de régression sur le seeder dev déjà testé. Un utilisateur e2e dédié est créé par rôle supplémentaire (`dpo-e2e@triptyk.eu`, `auditor-e2e@triptyk.eu`, `tech-admin-e2e@triptyk.eu`, mot de passe `123456789`), en plus des users encoder existants.

Le seeder e2e pose aussi les **référentiels** du registre d'accès (catégories de données, finalités, bases légales), miroir de [[@apps/backend/src/seeders/development.seeder.ts#DatabaseSeeder]]`#seedReferentials` : les specs d'accès en dépendent (selects du formulaire), et la base e2e étant recréée à chaque run, rien d'autre ne les pose.

## Base e2e isolée de la base de développement

Les tests e2e tournent sur `database_e2e`, jamais sur `database_dev` : `schema:fresh` détruit tout le schéma, un run e2e ne doit pas coûter les données de développement.

L'isolation tient en une règle, [[@apps/backend/src/configuration.ts#loadConfiguration]] : quand `E2E=true`, le nom de base de `DATABASE_URI` est remplacé par [[@apps/backend/src/configuration.ts#E2E_DATABASE_NAME]] via [[@apps/backend/src/configuration.ts#withDatabaseName]] — identifiants, hôte, port et query string conservés. Le drapeau est posé par les deux seules entrées e2e, les scripts `start:e2e` et `e2e:setup` de `@apps/backend/package.json`, jamais par un fichier `.env`.

Ce choix évite de dupliquer une URI de connexion dans `playwright.config.ts`, les scripts npm et la CI, et le secret `.env.e2e` chiffré (SOPS) n'a pas à être ré-encrypté pour changer de base. La base est créée à la volée par `ensureDatabase()` de MikroORM au premier `schema:fresh`, donc ni `docker-compose.yaml` ni le service Postgres de la CI n'ont à la déclarer.

Conséquence pour le développeur : plus besoin de rejouer `schema:fresh` (DatabaseSeeder) après un run e2e pour récupérer sa base dev.

### Garde-fou : l'E2ESeeder refuse une base non-e2e

Le drapeau reste une convention — deux scripts npm doivent penser à le poser. [[@apps/backend/src/configuration.ts#assertE2ECommandTargetsE2EDatabase]] en fait un invariant vérifié au point de destruction.

Appelée depuis [[@apps/backend/src/mikro-orm.config.ts]] au chargement de la config, elle lève dès que `process.argv` mentionne `E2ESeeder` alors que la base visée n'est pas `database_e2e`. Placement volontaire : `schema:fresh` détruit le schéma **avant** de semer, donc un garde à l'intérieur du seeder arriverait trop tard. Le filet couvre la troisième entrée e2e — script npm ajouté, étape CI, appel CLI à la main — qui oublierait `E2E=true`, quel que soit le runtime.

### Pourquoi un drapeau d'environnement et pas `import.meta.env.MODE`

Les deux entrées e2e passent par `vite-node --mode=e2e`, mais `import.meta.env` n'est fiable que pour l'une des deux.

`start:e2e` exécute `src/app.bootstrap.ts` dans le graphe de modules Vite : `import.meta.env.MODE` y vaut bien `e2e`. `e2e:setup` exécute en revanche la CLI MikroORM, qui charge `mikro-orm.config.ts` via **ts-node** (`"mikro-orm": { "useTsNode": true }` dans `@apps/backend/package.json`), hors du graphe Vite : `import.meta.env` y est `undefined`, la bascule ne se déclenche pas et `schema:fresh` détruit la base de développement — le piège exact que cette section existe pour fermer. Une variable d'environnement traverse les deux runtimes ; `import.meta.env` non.

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

## Export des accès par périmètre source system

`@apps/e2e/tests/access-export-scope.spec.ts` vérifie que l'export des accès demande un périmètre (source system précis ou « tous ») et que le filtrage est appliqué côté serveur.

Le test crée 2 source systems + un accès chacun via l'API (jeton encoder), puis, connecté en DPO : ouvre l'export → une modale de périmètre s'affiche (options « tous » + chaque source system), la confirmation est bloquée sans choix, et le choix déclenche le téléchargement. Le **contenu** est vérifié via l'export JSON (`POST /export`) : filtré par un code → ne contient que ses accès ; sans code → tous ; code inexistant → 404. Le PDF de l'UI n'étant pas introspectable, la vérification de contenu passe par le JSON du même endpoint filtré serveur.
