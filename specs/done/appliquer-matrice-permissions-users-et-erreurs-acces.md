# Appliquer la matrice de permissions au module Users (back + front, vrai moteur CASL front) et gérer proprement les accès refusés

## Problème

Un utilisateur `encoder` voit le lien « Users » dans le menu, peut cliquer dessus et **voit la liste complète des utilisateurs** — alors que, selon la matrice de permissions CASL seedée, seul `tech_admin` a le droit `manage:User`. Aucun rôle (`encoder`, `dpo`, `auditor`) n'a de règle sur le sujet `User`.

De plus, quand un accès est refusé ailleurs dans l'app (ex. `/dashboard/roles/create` pour un non-`tech_admin`), l'utilisateur est redirigé silencieusement vers `/dashboard` **sans aucun message** — perçu comme une « page blanche » incompréhensible plutôt qu'un refus d'accès explicite.

### Cause racine confirmée par lecture du code

**1. Backend (`@libs/users-backend`) — 3 routes sur 5 n'ont aucun guard de permission :**

| Route | Guard actuel | Attendu |
|---|---|---|
| `POST /users` (`create.route.ts`) | `requirePermission("manage", "User")` ✅ | — |
| `PATCH /users/:id` (`update.route.ts`) | `requirePermission("manage", "User")` ✅ | — |
| `GET /users` (`list.route.ts`) | **aucun** ❌ | `requirePermission("manage", "User")` |
| `GET /users/:id` (`get.route.ts`) | **aucun** ❌ | `requirePermission("manage", "User")` |
| `DELETE /users/:id` (`delete.route.ts`) | **aucun** (seul l'auto-suppression est bloquée) ❌ | `requirePermission("manage", "User")` |
| `GET /profile` (`profile.route.ts`) | aucun, **volontaire** — scope `request.user` (soi-même), pas la ressource `User` en général | inchangé |

`UserModule#setupRoutes` (`@libs/users-backend/src/init.ts`) ne pose qu'un hook d'authentification JWT au niveau du module — n'importe quel utilisateur **authentifié** peut aujourd'hui lister, consulter et **supprimer n'importe quel autre utilisateur**. Plus grave que le seul symptôme rapporté : `DELETE /users/:id` est exploitable par un `encoder`.

**2. Frontend menu et guards — aucune source de vérité côté client :**

Le lien « Roles » du menu (`@apps/front/app/templates/dashboard.gts`) et les routes `create.gts`/`edit.gts` de `users-front`/`permissions-front` utilisent `hasPermission(user)` (`@libs/users-front/src/utils/has-permission.ts`) :
```ts
export function hasPermission(user: User | undefined): boolean {
  return user?.roleName === 'tech_admin';
}
```
Ce n'est **pas une lecture de la matrice CASL** : c'est un nom de rôle en dur. Ça « marche » aujourd'hui par coïncidence (`manage:User` et `manage:Role` sont *actuellement* tous deux exclusifs à `tech_admin`), mais rien ne garantit que ça reste vrai, et surtout **le lien « Users » n'utilise même pas ce check** — il est affiché sans aucune condition. `dashboard/users/index.gts` n'a pas non plus de guard.

**3. « Page blanche » sur erreur de chargement de route :**

Aucun template `error.gts` (substate Ember) n'existe nulle part dans l'app. Si un `model()` de route rejette (403/404 renvoyé par WarpDrive sous forme d'`AggregateError`, cf. [[frontend/shared-front#Classification champ vs globale des erreurs JSON:API]]), Ember retombe sur un rendu quasi vide. C'est le point laissé volontairement hors périmètre (« Phase 4 optionnelle ») du plan précédent [[specs/done/afficher-erreurs-backend-non-champ.md]] — comblé ici car c'est la cause du symptôme rapporté.

## Objectif

1. Le backend applique la matrice CASL réellement sur **toutes** les routes `/users` qui exposent la ressource `User` (sauf `/profile`, scope-self).
2. **Le frontend dispose d'un vrai moteur de permissions** : il connaît la matrice CASL réelle de l'utilisateur connecté (pas un nom de rôle en dur) et l'interroge via `can(action, subject)`, exactement comme le backend interroge `request.ability`.
3. Menu et guards de route (`Users` et `Roles`) sont pilotés par ce moteur, pas par `hasPermission()` (qui est supprimé).
4. Tout refus d'accès (guard préventif OU 403/404 backend) affiche un message clair et redirige vers un endroit sûr — plus jamais de page blanche silencieuse.

## Architectural Context (advisory)

- **Contrat central** : `AppAbility = MongoAbility<[string, string]>` construit par [[@libs/permissions-backend/src/ability/ability-builder.ts#buildAbility]] via `createMongoAbility`. **CASL expose nativement `ability.rules`** (un tableau de règles packées, sérialisable) — c'est le mécanisme officiel documenté par CASL pour transmettre une ability serveur→client : on ne réinvente rien, on sérialise `request.ability.rules` et le front appelle `createMongoAbility(rules)` pour obtenir une ability **comportementalement identique**, y compris les `conditions` déjà interpolées (le jeton `$user.id` est résolu **côté backend**, cf. `interpolate()` dans `ability-builder.ts` — le front ne voit jamais le jeton brut, seulement la valeur concrète).
- **Cycle de dépendances à respecter** (déjà documenté [[backend/permissions#Sélecteur de rôle réservé à tech_admin]]) : `permissions-front` dépend de `users-front` (pour `CurrentUserService`) — l'inverse créerait un cycle. Le nouveau service d'ability doit donc vivre dans **`shared-front`** (zéro dépendance métier, déjà consommé par `users-front` ET `permissions-front`), pas dans l'un des deux.
- **`shared-front` reste portable** : elle n'importera ni entité ni type de `permissions-backend`/`permissions-front` — juste `@casl/ability` (déjà catalogué dans `pnpm-workspace.yaml`, déjà dépendance directe d'`access-registry-backend`/`permissions-backend`) et un type `[string, string]` générique.
- **Bénéfice non exploité immédiatement mais débloqué** : une fois l'ability réelle disponible côté front, elle permet aussi des checks **au niveau instance** (`ability.can('read', subject('AccessRecord', record))`), pas seulement des checks grossiers route/menu — utile pour un futur masquage fin de boutons d'action. Hors périmètre de ce ticket (qui ne couvre que Users + Roles), mais l'architecture le permet sans retouche.

## Approche technique

### Backend — combler les 3 guards manquants sur `/users`

Ajouter `preHandler: [requirePermission("manage", "User")]` à `ListRoute`, `GetRoute`, `DeleteRoute`, exactement comme `CreateRoute`/`UpdateRoute` (import `requirePermission` depuis `@libs/permissions-backend`). `DeleteRoute` : le guard s'exécute avant le handler, donc avant le check d'auto-suppression existant — aucun changement d'ordre nécessaire.

### Backend — nouvelle route `GET /me/ability` (expose l'ability du user courant)

Dans `@libs/permissions-backend/src/init.ts`, `PermissionsModule#setupRoutes` pose aujourd'hui un hook `preHandler: requirePermission("manage", "Role")` **au niveau du module entier** (`f.addHook("preHandler", ...)`), appliqué à toutes les routes `/roles`. La nouvelle route doit être accessible à **tout utilisateur authentifié** (chacun a le droit de connaître ses propres permissions) — elle ne peut donc pas vivre dans ce même bloc `fastify.register`. Ajouter un second bloc, sans le hook `manage:Role` :

```ts
public async setupRoutes(fastify: FastifyInstanceTypeForModule): Promise<void> {
  await fastify.register(async (f) => { /* bloc /roles existant, inchangé */ }, { prefix: "/roles" });

  await fastify.register(
    async (f) => {
      f.setErrorHandler((error, request, reply) => handleJsonApiErrors(error, request, reply));
      f.addHook("preValidation", this.authHook); // authentification seule, pas de requirePermission
      new GetMyAbilityRoute().routeDefinition(f);
    },
    { prefix: "/me" },
  );
}
```

`GetMyAbilityRoute` (nouveau fichier `#src/routes/get-my-ability.route.ts`) :
```ts
export class GetMyAbilityRoute implements Route {
  public routeDefinition(f: FastifyInstanceTypeForModule) {
    return f.get("/ability", { schema: { response: { 200: object({ data: object({ rules: array(any()) }) }) } } },
      async (request, reply) => {
        return reply.send({ data: { rules: request.ability!.rules } });
      },
    );
  }
}
```
`request.ability` est déjà peuplée par `authHook` (`createJwtAuthMiddleware`, injecté) — aucune nouvelle logique de construction d'ability, on lit juste ce qui existe déjà.

### Frontend — `AbilityService` générique dans `shared-front`

Nouveau fichier `@libs/shared-front/src/services/ability.ts` :

```ts
import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { createMongoAbility, type MongoAbility, type RawRuleOf } from '@casl/ability';

export type AppAbility = MongoAbility<[string, string]>;

// @lat: [[frontend/shared-front#Moteur de permissions front (AbilityService)]]
export default class AbilityService extends Service {
  @tracked private ability: AppAbility = createMongoAbility([]);

  load(rules: RawRuleOf<AppAbility>[]) {
    this.ability = createMongoAbility<AppAbility>(rules);
  }

  reset() {
    this.ability = createMongoAbility<AppAbility>([]);
  }

  can(action: string, subject: string): boolean {
    return this.ability.can(action, subject as never);
  }
}

declare module '@ember/service' {
  interface Registry {
    ability: AbilityService;
  }
}
```

Ajouter `@casl/ability` aux dépendances de `@libs/shared-front/package.json` (`catalog:`).

### Frontend — chargement de l'ability au bon moment

[[@libs/users-front/src/services/current-user.ts#CurrentUserService]] est **déjà** le point unique appelé (a) au boot de l'app si une session existe (`ApplicationRoute#beforeModel` → `initializeUserLib` → `currentUser.load()`) et (b) juste après une authentification réussie (`@apps/front/app/services/session.ts#MySession.handleAuthentication` → `await this.currentUser.load()`). C'est donc le point d'intégration naturel — pas besoin de nouveau câblage dans `application.ts`.

Étendre `CurrentUserService#load()` :
```ts
@service declare ability: AbilityService; // depuis shared-front, déjà une dépendance existante

async load() {
  if (!this.session.isAuthenticated) {
    this.user = undefined;
    this.ability.reset();
    return;
  }

  const response = await this.store.request(/* profile, inchangé */);
  this.user = response.content.data;

  const abilityPayload = await this.fetchMyAbility(); // fetch simple, voir note
  this.ability.load(abilityPayload.rules);
}
```

> **Décision à valider — mécanisme de fetch** : `GET /me/ability` ne modélise pas une vraie ressource JSON:API CRUD (pas d'`id`, pas d'`attributes` typées) — la faire transiter par une query WarpDrive imposerait d'enregistrer un schéma pour un type qui n'en a pas besoin (cf. piège déjà documenté [[frontend/access-record-options#Enregistrement obligatoire des schémas warp-drive]]). Recommandation : un `fetch()` simple avec le Bearer token lu depuis `session.data.authenticated` (même lecture que [[@libs/users-front/src/handlers/auth.ts#AuthHandler]]), pas de passage par le store. À confirmer en phase de build — l'alternative WarpDrive reste possible si la cohérence de style prime sur la simplicité.

### Frontend — remplacer `hasPermission()` par `ability.can(...)`, partout

**Supprimer** `@libs/users-front/src/utils/has-permission.ts` une fois tous les appelants migrés (sinon code mort trompeur). Remplacer chaque site :

- `@apps/front/app/templates/dashboard.gts` : le lien « Roles » (déjà conditionnel) devient `...(this.ability.can('manage', 'Role') ? [...] : [])`. Le lien « Users » (actuellement inconditionnel) devient `...(this.ability.can('manage', 'User') ? [...] : [])`.
- `@libs/users-front/src/routes/dashboard/users/{create,edit}.gts` (guard existant) et `index.gts` (guard **à créer**) : `beforeModel()` interroge `this.ability.can('manage', 'User')`.
- `@libs/permissions-front/src/routes/dashboard/roles/{index,create,edit}.gts` : `this.ability.can('manage', 'Role')`.

**Nouvel helper** `@libs/shared-front/src/utils/require-ability-or-redirect.ts` (remplace le helper `requirePermissionOrRedirect` initialement envisagé côté `users-front` — il vit désormais dans `shared-front` puisqu'il ne dépend plus de `User`/`hasPermission`, seulement de l'`AbilityService` générique) :

```ts
import type RouterService from '@ember/routing/router-service';
import type FlashMessageService from 'ember-cli-flash/services/flash-messages';
import type IntlService from 'ember-intl/services/intl';
import type AbilityService from '../services/ability.ts';
import { resolveJsonApiErrorMessage } from './json-api-error-message.ts';

interface Services {
  ability: AbilityService;
  router: RouterService;
  flashMessages: FlashMessageService;
  intl: IntlService;
}

export function requireAbilityOrRedirect(
  action: string,
  subject: string,
  services: Services,
  redirectTo = 'dashboard'
) {
  if (services.ability.can(action, subject)) return undefined;
  services.flashMessages.danger(
    resolveJsonApiErrorMessage({ code: 'FORBIDDEN', status: '403' }, services.intl)
  );
  return services.router.transitionTo(redirectTo);
}
```

Chaque route devient :
```ts
@service declare ability: AbilityService;
@service declare flashMessages: FlashMessageService;
@service declare intl: IntlService;
@service declare router: RouterService;

beforeModel() {
  return requireAbilityOrRedirect('manage', 'User', {
    ability: this.ability,
    router: this.router,
    flashMessages: this.flashMessages,
    intl: this.intl,
  });
}
```

Réutilise `resolveJsonApiErrorMessage`/`shared.handle-save.errors.FORBIDDEN` déjà créés — pas de nouvelle clé de traduction pour ce message court.

### Frontend — substate d'erreur pour les échecs de chargement (comble la « page blanche »)

Inchangé par rapport à la version précédente du plan : créer `@apps/front/app/routes/dashboard/error.ts` + `@apps/front/app/templates/dashboard/error.gts` (substate Ember standard, capté pour toute route enfant de `dashboard`). Le template reçoit l'erreur comme `@model`, en extrait `status`/`code` (forme `AggregateError` de WarpDrive) et affiche un message via `resolveJsonApiErrorMessage`/`genericJsonApiErrorMessage`, avec un lien `LinkTo @route="dashboard"`.

Nouvelle clé de traduction : `shared.error-page.backToDashboard` (fr: "Retour au tableau de bord", en: "Back to dashboard") dans `@apps/front/translations/shared/{fr-fr,en-us}.yaml`.

> Décision à valider : substate posé au niveau `dashboard` uniquement (couvre toutes les routes métier) ; hors périmètre pour login/forgot-password (pas de `model()` protégé là-bas).

## Guide d'implémentation (ordre suggéré)

1. **Backend `/users`** : ajouter les 3 guards manquants + tests.
2. **Backend `/me/ability`** : nouvelle route dans `permissions-backend` + test d'intégration (vérifie que les rules renvoyées correspondent au rôle du caller).
3. **Frontend `AbilityService`** : créer dans `shared-front` (+ dépendance `@casl/ability`) + test unitaire (`load`/`can`/`reset`).
4. **Frontend chargement** : brancher le fetch dans `CurrentUserService#load()` + test (mock du fetch, vérifie `ability.load` appelé avec les bonnes rules ; vérifie `ability.reset()` sur logout).
5. **Frontend helper de garde** : `requireAbilityOrRedirect` dans `shared-front` + test unitaire.
6. **Frontend migration** : remplacer tous les appels `hasPermission()` (menu, 6 routes) par `ability.can(...)`/le nouvel helper ; **supprimer** `has-permission.ts` et son test.
7. **Frontend substate d'erreur** : `dashboard/error.{ts,gts}` + traductions + test.
8. **lat.md** : `backend/permissions.md` (3 guards + route `/me/ability`), `frontend/shared-front.md` (nouveau `AbilityService`, nouveau helper, suppression de `hasPermission`, substate d'erreur).

## Stratégie de test (bloquant)

**Backend :**
1. Extension de `@libs/users-backend/tests/integration/permissions-matrix.test.ts` (pattern `describe.each` déjà en place) : `GET /users -> 403/200`, `GET /users/:id -> 403/200`, `DELETE /users/:id -> 403/204` (cible ≠ caller).
2. Nouveau test `permissions-backend` : `GET /me/ability` renvoie 200 pour tout utilisateur authentifié (quel que soit le rôle) ; les `rules` renvoyées pour un `encoder` **ne contiennent pas** de règle `User`/`Role`, celles d'un `tech_admin` **contiennent** `{action: 'manage', subject: 'User'}`.

**Frontend :**
3. `ability-test.gts` (unit, `shared-front`) : `load(rules)` puis `can()` reflète les rules chargées ; `reset()` vide l'ability ; une ability vide refuse tout (`can('manage','User')` → `false`).
4. `current-user-test.gts` (existant, à étendre) : `load()` appelle `ability.load()` avec les rules renvoyées par le fetch mocké ; `load()` sans session appelle `ability.reset()`.
5. `require-ability-or-redirect-test.gts` (unit, `shared-front`) : autorisé → pas de transition/flash ; refusé → `transitionTo` + `flashMessages.danger` avec le message résolu.
6. `users-test.gts` (acceptance, `users-front`, nouveau, sur le modèle de `roles-test.gts`) : redirection `/dashboard/users`(+`/create`) pour un ability sans `manage:User`, pas de redirection sinon, **et vérifie la présence du flash `danger`** (point que `roles-test.gts` ne couvrait pas).
7. `roles-test.gts` (existant) : migrer le mock (il stubbe aujourd'hui `currentUser.user = {roleName}` — à remplacer par un stub de `ability.can`/`ability.load`) et vérifier qu'il reste vert.
8. Test du substate d'erreur : `model()` qui rejette avec une `AggregateError` 403 → `dashboard/error.gts` affiche le message attendu.

Commandes : `pnpm turbo test --filter=@libs/users-backend --filter=@libs/permissions-backend --filter=@libs/shared-front --filter=@libs/users-front --filter=@libs/permissions-front --filter=@apps/front`.

## Critères de succès (vérifiables)

1. `GET/DELETE /users`, `GET /users/:id` renvoient 403 pour `encoder`/`dpo`/`auditor`, 200/204 pour `tech_admin`.
2. `GET /me/ability` renvoie les rules réelles du rôle de l'appelant, pas un rôle en dur.
3. Le lien « Users » n'apparaît dans le menu **que** si `ability.can('manage', 'User')` — vérifié en navigateur réel avec un compte `encoder` (absent) et `tech_admin` (présent), en plus des tests automatisés.
4. Naviguer vers `/dashboard/users`/`/roles` sans la permission requise redirige vers `/dashboard` **et affiche un flash `danger`** explicite.
5. Une erreur de chargement de route non interceptée par un guard affiche le substate `dashboard/error.gts`, plus jamais un rendu vide.
6. `hasPermission()`/`has-permission.ts` n'existe plus dans le code — tous les appelants sont passés à `ability.can(...)`.
7. `pnpm turbo lint test` vert sur `users-backend`, `permissions-backend`, `shared-front`, `users-front`, `permissions-front`, `apps/front`.
8. `lat.md` documente le nouveau `AbilityService`, la route `/me/ability`, et la suppression de `hasPermission()` ; `lat check` passe.

## Fichiers touchés

- `@libs/users-backend/src/routes/{list,get,delete}.route.ts`
- `@libs/users-backend/tests/integration/permissions-matrix.test.ts`
- `@libs/permissions-backend/src/routes/get-my-ability.route.ts` (nouveau)
- `@libs/permissions-backend/src/init.ts`
- `@libs/permissions-backend/tests/integration/` (nouveau test `/me/ability`)
- `@libs/shared-front/src/services/ability.ts` (nouveau)
- `@libs/shared-front/src/utils/require-ability-or-redirect.ts` (nouveau)
- `@libs/shared-front/tests/unit/{ability,require-ability-or-redirect}-test.gts` (nouveaux)
- `@libs/shared-front/package.json` (ajout `@casl/ability`)
- `@libs/users-front/src/services/current-user.ts` (fetch + `ability.load()`)
- `@libs/users-front/src/routes/dashboard/users/{index,create,edit}.gts`
- `@libs/users-front/src/utils/has-permission.ts` (**supprimé**)
- `@libs/users-front/tests/acceptance/users-test.gts` (nouveau)
- `@libs/permissions-front/src/routes/dashboard/roles/{index,create,edit}.gts`
- `@libs/permissions-front/tests/acceptance/roles-test.gts` (migration du mock)
- `@apps/front/app/templates/dashboard.gts` (menu Users + Roles via `ability`)
- `@apps/front/app/routes/dashboard/error.ts`, `@apps/front/app/templates/dashboard/error.gts` (nouveaux)
- `@apps/front/translations/shared/{fr-fr,en-us}.yaml` (clé `error-page.backToDashboard`)
- `lat.md/backend/permissions.md`, `lat.md/frontend/shared-front.md`

## Notes / risques / décisions à valider avec le demandeur

- **Fraîcheur de l'ability côté front** : chargée une fois au boot/à la connexion, **pas** reconstruite à chaque requête comme le fait le backend (cf. [[backend/permissions#Attachement de request.ability au chargement de l'utilisateur]] — "aucun risque de désynchronisation" côté backend précisément parce qu'il ne cache rien). Si un admin modifie la matrice de permissions pendant qu'un utilisateur est connecté, celui-ci ne verra le changement qu'après reconnexion/rechargement. Le backend reste la source de vérité appliquée à chaque requête — le front n'est qu'un filtre d'affichage, jamais la dernière ligne de défense. Acceptable en l'état ; un rafraîchissement périodique ou déclenché serait une amélioration future.
- **`request.ability!` dans `GetMyAbilityRoute`** : suppose que l'`authHook` a bien peuplé `request.ability` avant que la route ne s'exécute — vrai par construction (`preValidation` s'exécute avant le handler), mais à vérifier explicitement en test (401 si l'ability est absente, comme le fait déjà `requirePermission`).
- **`DELETE /users/:id`** était exploitable par n'importe quel `encoder` avant ce fix (suppression de comptes arbitraires) — à signaler si un audit rétroactif des logs d'accès est nécessaire avant déploiement.
- **Portée** : ce ticket applique le nouveau moteur à Users + Roles (les deux seuls points d'entrée actuellement gardés côté front). Les autres ressources (`AccessRecord`, `Incident`...) ne sont pas gardées côté front aujourd'hui (elles le sont côté backend) — étendre `ability.can(...)` à ces écrans est possible avec la même architecture mais hors périmètre explicite de ce ticket.
