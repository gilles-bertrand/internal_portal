# Services front partagés

`@libs/shared-front` est le seul addon Ember du monorepo sans domaine métier propre — il expose les services consommés par tous les formulaires et gardes de route des libs `*-front`.

Trois services : `HandleSaveService`, `ErrorReporterService`, `AbilityService` — évitent de dupliquer les patterns save/erreur/flash/transition et permission/redirection dans chaque lib.

[[@libs/shared-front/src/services/handle-save.ts#HandleSaveService]] encapsule un pattern à 4 effets : exécuter l'action de sauvegarde, afficher un flash de succès (avec repli `intl.exists()` → clé traduite sinon message brut), transitionner optionnellement via le router Ember, et en cas d'erreur classifier chaque entrée JSON:API en erreur **de champ** ou **globale**. C'est le point d'intégration entre le changeset Immer et le format d'erreur JSON:API renvoyé par le backend ([[platform#Enveloppe JSON:API et gestion d'erreurs partagées]]).

`ErrorReporterService` est un stub volontaire (`console.error`, commentaire Sentry non branché) — préparation à une intégration de monitoring non encore active.

## Classification champ vs globale des erreurs JSON:API

WarpDrive emballe toute réponse d'erreur JSON:API — 400 de validation comme 401/403/404/409/500 — dans un même `AggregateError`, y compris les erreurs sans `source`.

L'ancien code supposait `source.pointer` toujours présent, ce qui levait un `TypeError` avalé silencieusement sur toute erreur non liée à un champ (403 `requirePermission`, 409 de suppression de rôle, 500…) — rien n'était alors affiché à l'utilisateur. Cf. [[platform#Enveloppe JSON:API et gestion d'erreurs partagées]] pour le format d'erreur backend (`makeJsonApiError`) à l'origine de ces payloads sans `source`.

`isFieldError(e)` classe une erreur comme **de champ** ssi `source.pointer` matche `/data/attributes/` — sinon elle est **globale** :
- Erreurs de champ (avec `changeset`) → `changeset.addError()`, affichage inline (comportement historique).
- Erreurs globales, ou absence totale de `changeset` (alors toutes les erreurs sont globales par défaut, y compris celles au pointer de champ — rien d'autre où les attacher) → flash `danger` via `resolveJsonApiErrorMessage()`.
- Un `AggregateError` mixte (champ + globale) traite chaque catégorie indépendamment.
- Une erreur non-`AggregateError` (échec réseau, corps non-JSON) déclenche désormais aussi un flash `danger` générique en plus du `errorReporter.report()` — auparavant silencieuse (seul `console.error`).

## Priorité de résolution du message (erreurs globales)

[[@libs/shared-front/src/utils/json-api-error-message.ts#resolveJsonApiErrorMessage]] résout le texte affiché dans cet ordre : `shared.handle-save.errors.<code>` → `shared.handle-save.status.<status>` → `detail` brut du backend → `shared.handle-save.generic-error-message`, chaque étape gardée par `intl.exists()`.

Extraite en fonction pure hors de `HandleSaveService` (avec `genericJsonApiErrorMessage`) pour être réutilisable par un appelant qui reçoit un document d'erreur JSON:API sans passer par le flux save/changeset/AggregateError de WarpDrive — cf. section login ci-dessous.

Restriction : le repli sur `detail` est **désactivé pour les erreurs 5xx** (`status` commençant par `5`) — ce texte est un message serveur interne (ex. stack trace), pas destiné à l'utilisateur final ; une 5xx sans traduction `code`/`status` tombe directement sur le message générique. Les erreurs 5xx déclenchent aussi `errorReporter.report()` en plus du flash, pour le futur monitoring (uniquement dans `HandleSaveService` — la fonction pure ne fait pas de reporting).

Namespace de traduction `shared/` (`@apps/front/translations/shared/{fr-fr,en-us}.yaml`) — créé pour ce besoin, n'existait pas avant (`wrapTranslationsWithNamespace: true` dans `ember-intl.config.mjs` mappe chaque sous-dossier vers son namespace). Couvre `generic-error-message`, `errors.UNAUTHORIZED`/`FORBIDDEN`, `status.401/403/404/409/422/500`.

## Login : erreur d'authentification non affichée

Le formulaire de login (`LoginForm`, `@libs/users-front/src/components/forms/login-form.gts`) appelait `this.session.authenticate(...)` sans jamais capturer le rejet — un échec de connexion ne montrait strictement rien à l'utilisateur.

Cause : login ne passe pas par le store WarpDrive (pas de `saveAction`/`HandleSaveService`) mais par `ember-simple-auth-token`, dont l'authenticator `Token#makeRequest` rejette avec `{ status, statusText, headers, text, json }` — `json.errors` porte le même document JSON:API que le reste du backend ([[backend/users-auth#RBAC sur le module users : résolu]] pour `LoginRoute`), mais ce n'est **pas** un `AggregateError` (WarpDrive n'est pas dans la boucle). `HandleSaveService.handleSave()` ne peut donc pas être réutilisé tel quel ici.

Fix : `onSubmit` capture le rejet, extrait `error.json.errors[0]` et appelle directement `resolveJsonApiErrorMessage`/`genericJsonApiErrorMessage` (les mêmes fonctions pures que `HandleSaveService`) pour poser un flash `danger` — sans changeset (login n'a pas d'erreurs de champ à afficher inline, seulement une raison de rejet globale : identifiants invalides, compte verrouillé…).

## Moteur de permissions front (AbilityService)

[[@libs/shared-front/src/services/ability.ts#AbilityService]] enveloppe une vraie ability CASL (`createMongoAbility`), plutôt que le check `roleName === 'tech_admin'` en dur de l'ancien `hasPermission()` (supprimé).

Même `AppAbility = MongoAbility<[string, string]>` que le backend (`@libs/permissions-backend/src/ability/ability-builder.ts`) — comportement identique côté front et back.

Vit dans `shared-front` (pas `users-front` ni `permissions-front`) pour la même raison que les autres services de cette lib : `permissions-front` dépend déjà de `users-front` pour `CurrentUserService`, l'inverse créerait un cycle — `shared-front` est le seul point neutre consommable par les deux. `@casl/ability` est une dépendance directe de `shared-front` (comme de `permissions-backend`/`access-registry-backend` côté serveur).

Rules chargées via `ability.load(rules)`, où `rules` vient de `GET /me/ability` (cf. [[backend/permissions#Route GET /me/ability]]) — un `fetch()` direct (pas une query WarpDrive : la réponse `{ data: { rules: [...] } }` n'est pas une ressource JSON:API typée, l'enregistrer comme schéma serait un détour inutile). Câblé dans [[@libs/users-front/src/services/current-user.ts#CurrentUserService]]`#load()`, le point déjà appelé au boot de l'app (session existante) et juste après connexion (`@apps/front/app/services/session.ts#MySession.handleAuthentication`) — aucun nouveau point de câblage à créer. `ability.reset()` est appelé symétriquement quand la session n'est plus authentifiée.

Fraîcheur : contrairement au backend qui reconstruit `request.ability` à chaque requête (cf. [[backend/permissions#Attachement de request.ability au chargement de l'utilisateur]]), l'ability front n'est chargée qu'une fois par session (boot/connexion) — un changement de matrice pendant une session active n'est visible qu'après reconnexion/rechargement. Le backend reste la seule ligne de défense réelle ; le front n'est qu'un filtre d'affichage (menu, guards de route).

Résilience : l'appel à `/me/ability` est enveloppé dans un `try/catch` dans `CurrentUserService#load()` — un échec réseau/serveur retombe sur `ability.reset()` (tout refusé) plutôt que de laisser l'exception se propager. Nécessaire car `load()` est appelé depuis `ApplicationRoute#beforeModel`, qui n'a **aucun** substate d'erreur au-dessus de lui (le substate `dashboard/error` ne couvre que les routes sous `dashboard`) — sans ce garde-fou, un pépin sur ce seul endpoint aurait empêché **tout** le boot de l'app pour l'utilisateur concerné.

`requireAbilityOrRedirect(action, subject, services, redirectTo?)` ([[@libs/shared-front/src/utils/require-ability-or-redirect.ts#requireAbilityOrRedirect]]) centralise le pattern garde+flash+redirection dupliqué 6 fois (`users-front`: `users/{index,create,edit}.gts` ; `permissions-front`: `roles/{index,create,edit}.gts`) — réutilise `resolveJsonApiErrorMessage`/`shared.handle-save.errors.FORBIDDEN` pour le message du flash, pas de nouvelle clé de traduction.

## Substate d'erreur dashboard/error

`@apps/front/app/templates/dashboard/error.gts` capte toute erreur de chargement de route (`model()`/`beforeModel()` qui rejette) sous `dashboard/*`, remplaçant le rendu quasi vide par défaut d'Ember par un message + lien de retour.

`app/routes/dashboard/error.ts` reste vide (pas de `model()` custom) — Ember fournit automatiquement l'erreur rejetée comme modèle du substate.

Le composant reçoit l'erreur rejetée comme `@model` (convention Ember standard pour les substates `error`, indépendante du resolver classique vs strict) et réutilise `resolveJsonApiErrorMessage`/`genericJsonApiErrorMessage` pour le corps du message (mêmes clés `shared.handle-save.*`) avec un titre dédié par status (`shared.error-page.titles.{403,404,generic}`) et un lien `shared.error-page.backToDashboard`.

Portée : posé uniquement sous `dashboard` (couvre users/todos/access-records/incidents/roles) — pas login/forgot-password, qui n'ont pas de `model()` chargeant une ressource protégée. Couverture de test : le rendu du composant est testé exhaustivement (403/404/générique) via `renderingTest` + chargement manuel des traductions réelles (`intl.addTranslations`, car `renderingTest` ne boote pas `ApplicationRoute`) — le câblage routing réel (Ember thread bien l'erreur rejetée vers `@model` du substate) s'appuie sur un comportement Ember cœur, non re-testé en conditions live faute de serveur de dev dans cette session.

## Piège de test : `intl.exists()` toujours faux dans le harnais unitaire de shared-front

`tests/app.ts` de `@libs/shared-front` n'enregistre aucune traduction réelle — `intl.exists('shared.handle-save...')` y est donc toujours `false`, quel que soit le contenu des fichiers de traduction.

`intl.setOnMissingTranslation` y renvoie `t:<clé>` plutôt qu'un texte traduit, quel que soit le contenu réel de `@apps/front/translations/shared/`. Les tests unitaires de `messageForError` doivent donc mocker `intl.exists`/`intl.t` explicitement (`vi.spyOn`) pour exercer la chaîne de priorité code→status→detail→générique, plutôt que d'attendre le texte traduit réel — voir `handle-save-test.gts` (`@libs/shared-front/tests/unit/`, non lié en wiki-link : `.gts` non supporté par `lat check`).
