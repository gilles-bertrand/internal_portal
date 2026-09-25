# Fondations permissions : CASL + rôles/permissions en base + assignation de rôle à la création utilisateur

## Problème et objectifs

Le projet définit 4 rôles (`encoder`, `dpo`, `auditor`, `tech_admin`, cf. [[backend/users-auth#Rôles utilisateur et authentification]]) mais :

- `role` est un `string` libre en base, jamais validé.
- Le middleware `requireRole` existe mais n'est branché sur aucune route — `CreateRoute` accepte un `role` arbitraire dans le body sans vérifier qui appelle. Un `encoder` peut se créer un compte `tech_admin`.
- Les règles d'autorisation réelles vivent en dur, dispersées dans 7 fichiers d'`access-registry-backend`/`incident-registry-backend` (`if (user.role === "encoder")`, etc.).
- Rien ne permet d'attribuer un rôle depuis l'UI de création utilisateur.

Objectifs de ce plan :

1. Un utilisateur `tech_admin` peut créer un compte et lui assigner un rôle, via une UI dédiée.
2. Les rôles et leurs permissions sont stockés en base et gérables via une UI d'administration (pas de redeploy pour changer un droit).
3. Les vérifications d'autorisation passent par [CASL](https://casl.js.org/) (`@casl/ability`), avec des règles chargées depuis la base — fondation générique pour tout futur contrôle d'accès du projet.
4. Le module est conçu pour être extractible plus tard vers le template/boilerplate interne (aucune dépendance dure à `internal_portal` au-delà des entités génériques Role/PermissionRule).
5. Une suite de tests automatisés couvre systématiquement **chacun des 4 rôles** (pas seulement quelques cas ad hoc) : pour chaque rôle, on vérifie qu'un utilisateur de ce rôle obtient bien l'accès attendu (200/2xx) sur les actions qui lui sont permises et un refus (403) sur celles qui ne le sont pas — voir [[#Stratégie de tests (bloquant)]] pour la matrice exacte.

La migration des vérifications déjà en dur dans `access-registry-backend`/`incident-registry-backend` vers ce système est traitée dans le plan de suivi [[specs/todo/02-permissions-registries-retrofit.md]] — ce plan-ci pose uniquement les fondations + le module `users`.

## Décisions actées

- **Qui administre les comptes/rôles** : `tech_admin` uniquement (cohérent avec son exclusion déjà actée du contenu métier des registres — séparation technique/métier).
- **Modèle de permissions** : CASL, règles `{action, subject, conditions?, inverted?}` stockées en base (table par rôle), gérables via UI. Pas de table de permissions normalisée séparée — on stocke des règles CASL brutes, pattern recommandé par la lib pour du RBAC piloté en base.
- **Seed** : les 4 rôles existants sont recréés en base avec un jeu de règles reproduisant *exactement* le comportement actuel (zéro régression). L'UI permet ensuite de les ajuster.
- **Portabilité** : le module `permissions-backend`/`permissions-front` ne doit connaître aucune entité métier spécifique (`AccessRecord`, `Incident`, ...) — les `subject` sont des chaînes libres configurées au niveau des modules consommateurs, pas au niveau du module permissions.

## Contexte architectural (graphify)

- Communautés touchées : `Users Backend Package - @Fastify @Mikro` (8), `Front Package - Ember @Warp` (0).
- God node à surveiller : `FastifyInstanceTypeForModule` (22-23 arêtes) — ce plan ajoute un nouveau module Fastify (`PermissionsModule`) suivant le même pattern que `UserModule`/`AuthModule` ; ne pas modifier la signature du type partagé, seulement l'instancier.
- Aucune connexion surprenante du rapport ne touche `users-backend` ou les rôles — pas de couplage caché identifié au-delà de ce qui est déjà documenté dans `lat.md/backend/users-auth.md`.
- Rappel avisé : le graphe est un pointeur d'orientation, pas une source de vérité — chaque fichier cité dans ce plan a été lu directement pendant la préparation.

## Architecture

### Nouvelle librairie `@libs/permissions-backend`

Suit le pattern boilerplate existant (`Route`/`ModuleInterface` de `@libs/backend-shared`, cf. [[@libs/access-registry-backend]] comme référence de structure). Scaffolder avec le skill `new-library` si possible, sinon copier la structure de `access-registry-backend`.

```
@libs/permissions-backend/
  src/
    entities/
      role.entity.ts
      permission-rule.entity.ts
    ability/
      ability-builder.ts       # construit une CASL Ability à partir des règles d'un rôle
      subjects.ts              # union de types des "subjects" possibles (extensible par les autres libs)
    middlewares/
      require-permission.middleware.ts   # remplace require-role dans les usages futurs
    routes/
      list-roles.route.ts
      create-role.route.ts
      update-role.route.ts     # inclut le remplacement des règles d'un rôle
      delete-role.route.ts
    serializers/
      role.serializer.ts
    context.ts
    init.ts                    # PermissionsModule (ModuleInterface)
    index.ts
```

**`role.entity.ts`**

```ts
import { defineEntity, p, type InferEntity } from "@mikro-orm/core";

export const RoleEntity = defineEntity({
  name: "Role",
  properties: {
    id: p.string().primary(),
    name: p.string().unique(),        // "encoder", "dpo", "auditor", "tech_admin", ...
    description: p.string().nullable(),
  },
});

export type RoleEntityType = InferEntity<typeof RoleEntity>;
```

**`permission-rule.entity.ts`**

```ts
import { defineEntity, p, type InferEntity } from "@mikro-orm/core";
import { RoleEntity } from "./role.entity.js";

export const PermissionRuleEntity = defineEntity({
  name: "PermissionRule",
  properties: {
    id: p.string().primary(),
    role: p.manyToOne(() => RoleEntity),
    action: p.string(),               // "create" | "read" | "update" | "delete" | "manage" | ...
    subject: p.string(),              // "AccessRecord" | "Incident" | "User" | "Role" | ...
    conditions: p.json().nullable(),  // ex: { "encodedBy": "$user.id" } — interpolé à la construction de l'ability
    fields: p.json().nullable(),      // restriction de champs, optionnel — v1 : non exploité par l'UI, réservé pour plus tard
    inverted: p.boolean().default(false), // règle "cannot"
    order: p.integer().default(0),    // ordre d'application ; CASL fait gagner la dernière règle qui matche — les "cannot" doivent avoir un order plus élevé
  },
});

export type PermissionRuleEntityType = InferEntity<typeof PermissionRuleEntity>;
```

> Vérifier la syntaxe exacte de relation `manyToOne` dans l'API `defineEntity` de la version de MikroORM utilisée par le projet (`@mikro-orm/core`) — le nom de méthode peut différer légèrement (`p.manyToOne` vs autre) ; s'aligner sur un exemple de relation déjà présent ailleurs dans le monorepo si `role.entity.ts` ne compile pas tel quel.

**`ability-builder.ts`**

```ts
import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import type { PermissionRuleEntityType } from "#src/entities/permission-rule.entity.js";

export type AppAbility = MongoAbility<[string, string]>;

interface UserForAbility {
  id: string;
}

function interpolate(conditions: Record<string, unknown> | null, user: UserForAbility) {
  if (!conditions) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(conditions)) {
    result[key] = value === "$user.id" ? user.id : value;
  }
  return result;
}

export function buildAbility(rules: PermissionRuleEntityType[], user: UserForAbility): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  for (const rule of [...rules].sort((a, b) => a.order - b.order)) {
    const conditions = interpolate(rule.conditions as Record<string, unknown> | null, user);
    if (rule.inverted) {
      cannot(rule.action, rule.subject, conditions);
    } else {
      can(rule.action, rule.subject, conditions);
    }
  }

  return build();
}
```

**`require-permission.middleware.ts`**

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import { makeJsonApiError } from "@libs/backend-shared";

// @lat: [[backend/permissions#Guard requirePermission]]
export function requirePermission(action: string, subject: string) {
  return async function permissionGuard(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user || !request.ability) {
      return reply.code(401).send(
        makeJsonApiError(401, "Unauthorized", { code: "UNAUTHORIZED", detail: "Not authenticated" }),
      );
    }
    if (!request.ability.can(action, subject)) {
      return reply.code(403).send(
        makeJsonApiError(403, "Forbidden", { code: "FORBIDDEN", detail: "Insufficient permission" }),
      );
    }
  };
}
```

`request.ability` est une nouvelle propriété Fastify (déclaration de type à ajouter, cf. pattern existant de `request.user` dans `users-backend`). Elle est attachée dans le middleware JWT (voir plus bas), pas ici — `requirePermission` ne fait que la lire.

**Routes `roles`** (préfixe `/roles`, guard `requirePermission("manage", "Role")` sur tout le groupe sauf lecture si on veut permettre à d'autres rôles de lister les rôles disponibles pour affichage — à trancher en implémentation ; par défaut, tout guardé `manage:Role` pour rester conservateur) :

- `GET /roles` — liste des rôles (id, name, description, nombre de règles).
- `GET /roles/:id` — détail d'un rôle + ses règles.
- `POST /roles` — création d'un rôle (`name`, `description`).
- `PATCH /roles/:id` — édition `name`/`description`.
- `PUT /roles/:id/rules` — remplace l'intégralité des règles d'un rôle (delete + recreate en transaction ; plus simple et plus sûr qu'un diff fin pour une matrice de permissions).
- `DELETE /roles/:id` — refuse si des `User` référencent encore ce rôle (409).

### Intégration `users-backend`

- `user.entity.ts` : remplacer `role: p.string().default("encoder")` par une relation `role: p.manyToOne(() => RoleEntity)`. Garder un accès pratique au nom du rôle via le serializer (join `user.role.name`).
- `jwt-auth.middleware.ts` : après avoir chargé l'utilisateur, charger aussi ses `PermissionRule` (via `user.role`, `populate: ["role"]` + fetch des règles du rôle) et attacher `request.ability = buildAbility(rules, user)` en plus de `request.user`.
- `create.route.ts` :
  - Guard `requirePermission("manage", "User")` (donc `tech_admin` uniquement, selon le seed).
  - `role` dans le body devient `roleId: string()` (référence à un `Role` existant), validé par une lookup en base (404/400 si le rôle n'existe pas) — plus d'assignation d'une string arbitraire.
- `update.route.ts` : même guard, même validation si `roleId` est fourni dans le patch.
- `list.route.ts` / `get.route.ts` : inclure `role.name` dans la sérialisation pour affichage front (tableau des utilisateurs, formulaire d'édition).
- `login.route.ts` / `refresh.route.ts` : corriger l'incohérence documentée dans [[backend/users-auth#Authentification JWT et rotation des refresh tokens]] — `refresh.route.ts` doit régénérer le token avec le même claim `role` (nom du rôle) que `login.route.ts`. Ce claim JWT reste **informationnel** (affichage front) ; l'autorisation réelle repasse toujours par `request.ability`, reconstruite depuis la base à chaque requête via le middleware JWT — donc pas de risque de désynchronisation entre le claim et les droits réels.

### Seed (remplace le comportement actuel, zéro régression)

Étendre `DatabaseSeeder` (et `E2ESeeder` si besoin) pour créer les 4 rôles et leurs règles avant de créer les utilisateurs :

```ts
private async seedRolesAndPermissions(em: EntityManager) {
  const roles = {
    encoder: await this.ensureRole(em, "encoder", "Encode les accès et incidents"),
    dpo: await this.ensureRole(em, "dpo", "Délégué à la protection des données"),
    auditor: await this.ensureRole(em, "auditor", "Audite l'intégrité des registres"),
    tech_admin: await this.ensureRole(em, "tech_admin", "Administration technique et comptes"),
  };

  await this.ensureRules(em, roles.encoder, [
    { action: "create", subject: "AccessRecord" },
    { action: "read", subject: "AccessRecord", conditions: { encodedBy: "$user.id" } },
    { action: "create", subject: "Incident" },
  ]);
  await this.ensureRules(em, roles.dpo, [
    { action: "read", subject: "AccessRecord" },
    { action: "manage", subject: "AccessRecordRetention" },
    { action: "read", subject: "AccessRecordIntegrity" },
  ]);
  await this.ensureRules(em, roles.auditor, [
    { action: "read", subject: "AccessRecordIntegrity" },
    { action: "read", subject: "IncidentIntegrity" },
  ]);
  await this.ensureRules(em, roles.tech_admin, [
    { action: "manage", subject: "User" },
    { action: "manage", subject: "Role" },
    // cannot en dernier (order plus élevé) pour gagner sur d'éventuels "can" hérités
    { action: "manage", subject: "AccessRecord", inverted: true, order: 10 },
    { action: "manage", subject: "Incident", inverted: true, order: 10 },
  ]);
}
```

Le mapping exact action/subject par rôle doit être calqué sur le tableau de correspondance du plan de suivi ([[specs/todo/02-permissions-registries-retrofit.md#Mapping]]), pour garantir qu'aucun comportement actuel ne change tant que le retrofit des registres n'est pas fait.

### Frontend : nouvelle librairie `@libs/permissions-front`

Miroir de `permissions-backend`, même souci de portabilité (pas de dépendance à `access-registry-front`/`incident-registry-front`).

```
@libs/permissions-front/
  src/
    schemas/roles.ts              # warp-drive schema "roles"
    services/role.ts              # CRUD roles via store
    components/
      role-permission-matrix.gts  # tableau action x subject en checkboxes, par rôle
      forms/role-form.gts         # name/description
    routes/dashboard/roles/
      index.gts / index-template.gts       # liste des rôles + bouton "Nouveau rôle"
      create.gts / create-template.gts     # formulaire de création (name/description), puis redirige vers edit une fois créé
      edit.gts / edit-template.gts         # édition name/description + matrice de permissions
    index.ts                      # initialize() + routes() + install de la route sidebar, pattern des autres *-front
```

- **La création d'un rôle est une fonctionnalité de premier plan de cette UI, pas un à-côté** : `/dashboard/roles/create` expose `role-form.gts` (name + description, validation d'unicité du nom — le backend renvoie 409 sur un `name` déjà pris, à afficher comme erreur de formulaire), soumet `POST /roles`, puis redirige vers `/dashboard/roles/:id/edit` pour composer sa matrice de permissions. Le rôle nouvellement créé doit apparaître **immédiatement** (sans redéploiement) dans le sélecteur de rôle du formulaire de création utilisateur (`user-form.gts`, cf. section suivante) — puisque ce sélecteur lit `GET /roles` à chaud.
- **Scope UI v1** : la matrice de permissions édite uniquement `action`/`subject` (cases à cocher), pas les `conditions` ni `fields` — ces deux champs restent gérés par seed/migration en v1. À documenter clairement dans l'UI ("règles avancées non éditables ici") pour ne pas donner une fausse impression d'exhaustivité.
- Accès à `/dashboard/roles` (liste, création, édition) gardé côté route (redirect si `currentUser.role.name !== "tech_admin"`, en attendant qu'un vrai check de permission front existe — cf. note ci-dessous) et côté API (guard `manage:Role`).
- Brancher dans le host app (`@apps/front`) en suivant exactement la checklist à 5 points déjà documentée dans `lat.md/apps/front-integration.md` (dépendance `package.json`, `router.ts`, `routes/application.ts` (init + MSW), `app.css` `@source`, `templates/dashboard.gts` sidebar + traductions) — c'est le piège systémique déjà rencontré 4 fois sur ce projet, ne pas le reproduire une 5e fois.

### Frontend : module `users`

- `schemas/users.ts` : le champ `role` (string) devient une relation ou un attribut `roleId` + `roleName` (selon ce que le serializer backend expose) — aligner avec la sérialisation JSON:API réelle du backend une fois celle-ci décidée en implémentation.
- `user-form.gts` : ajouter un `F.TpkSelectPrefab` (ou équivalent standalone déjà utilisé dans le projet, cf. migration récente vers `TpkSelect` standalone dans `incident-table`) pour choisir le rôle, alimenté par `GET /roles`. **Visible/actionnable uniquement si l'utilisateur courant est `tech_admin`** — sinon le champ est caché (un utilisateur non-admin ne devrait de toute façon jamais atteindre cet écran si la route est elle-même gardée, mais défense en profondeur au niveau composant).
- `user-validation.ts` / `changesets/user.ts` : ajouter `roleId` (requis à la création, optionnel à l'édition).
- `services/user.ts` : inclure `roleId` dans le payload de `create`/`update`.
- Garder la route `dashboard.users.create`/`edit` accessible seulement à `tech_admin` (redirect sinon), même logique que pour `/dashboard/roles`.
- Traductions FR/EN pour le nouveau champ "Rôle" et les libellés des 4 rôles.

### Note sur les permissions front

Ce plan introduit un besoin récurrent : "afficher/cacher une action UI selon la permission de l'utilisateur courant". Pour rester cohérent avec le choix CASL côté backend, prévoir dans `permissions-front` un petit helper `hasPermission(currentUser, action, subject)` — même s'il reste basé sur `currentUser.role.name === "tech_admin"` en v1 (pas de duplication de la logique CASL côté client dans ce plan), pour centraliser le point de décision et pouvoir le faire évoluer plus tard sans toucher chaque composant.

## Étapes d'implémentation

1. Ajouter la dépendance `@casl/ability` (workspace `@libs/permissions-backend`).
2. Scaffolder `@libs/permissions-backend` (entités, ability-builder, middleware, routes, module, context) — brancher dans `app.ts`/`app.router.ts`/`database.connection.ts` en suivant le pattern `AccessRegistryModule`.
3. Modifier `UserEntity` pour la relation `role`, régénérer le schéma (`pnpm mikro-orm schema:update --run` en dev).
4. Étendre `jwt-auth.middleware.ts` pour attacher `request.ability`.
5. Guard `create.route.ts`/`update.route.ts` avec `requirePermission("manage", "User")`, validation `roleId`.
6. Corriger le bug du claim `role` manquant dans `refresh.route.ts`.
7. Étendre `DatabaseSeeder`/`E2ESeeder` avec les rôles et règles de seed.
8. Scaffolder `@libs/permissions-front`, brancher dans `@apps/front` (checklist 5 points).
9. Adapter `users-front` : formulaire, validation, changeset, service, traductions.
10. Documentation `lat.md/` : nouvelle section `backend/permissions.md`, mise à jour de `backend/users-auth.md` (le trou de sécurité documenté est résolu — remplacer la note par une référence au nouveau guard), `apps/front-integration.md` si un nouveau piège est découvert.

## Stratégie de tests (bloquant)

- **Backend, `permissions-backend`** : tests unitaires de `buildAbility` (interpolation `$user.id`, priorité des règles `inverted`/`order`, règle `manage` couvrant toutes les actions).
- **Backend, `users-backend`** : tests d'intégration —
  - un `tech_admin` peut créer un utilisateur avec un `roleId` valide ;
  - un `encoder`/`dpo`/`auditor` reçoit 403 sur `POST /users` et `PATCH /users/:id` ;
  - `POST /users` avec un `roleId` inexistant renvoie 400/404 ;
  - le refresh token régénère bien un claim `role` identique au login.
- **Backend, `roles` routes** : CRUD complet + guard `manage:Role`, et `DELETE /roles/:id` refusé si un `User` référence encore ce rôle.
- **Frontend** : test d'intégration du formulaire de création utilisateur (le sélecteur de rôle apparaît, soumission inclut `roleId`) ; test du formulaire de création de rôle (`/dashboard/roles/create` — soumission crée le rôle, le nom en doublon affiche l'erreur 409, redirection vers l'édition de la matrice) ; test du composant matrice de permissions (toggle d'une case déclenche bien l'update attendu) ; test de garde de route (`/dashboard/roles` et `/dashboard/roles/create` redirigent un non-`tech_admin`).

### Matrice de couverture obligatoire : un test par utilisateur × par rôle

Ne pas se contenter de quelques cas ad hoc côté `tech_admin`. La suite doit créer/utiliser **un utilisateur fixture par rôle** (les 4 : `encoder`, `dpo`, `auditor`, `tech_admin` — via `ensureUser`/`E2ESeeder` ou un helper de test dédié `createUserWithRole(em, roleName)`) et, pour chacun, exercer explicitement :

| Utilisateur (rôle) | `POST /users` (créer un compte) | `GET /roles` (lister les rôles) | `PATCH /users/:id` (modifier un rôle) |
|---|---|---|---|
| `encoder` | 403 | 403 | 403 |
| `dpo` | 403 | 403 | 403 |
| `auditor` | 403 | 403 | 403 |
| `tech_admin` | 200 | 200 | 200 |

Concrètement : une seule fonction paramétrée (`it.each` / `describe.each` selon le framework de test déjà utilisé dans `users-backend`) itérant sur les 4 rôles, plutôt que 4 blocs de test copiés-collés — pour que l'ajout d'un futur 5e rôle dans le seed casse visiblement le test tant que sa ligne n'est pas ajoutée à la matrice.

Cette matrice est un critère de succès bloquant — un smoke test manuel, ou un test qui ne couvre que `tech_admin` + "un autre rôle au hasard", ne satisfait pas cette exigence : les 4 rôles doivent chacun être exercés et vérifiés.

## Critères de succès

1. `pnpm dev` démarre sans erreur avec les nouvelles entités `Role`/`PermissionRule` et le module `permissions-backend` initialisé.
2. Le seed crée exactement 4 rôles avec des règles reproduisant le comportement actuel (vérifié par les tests d'intégration existants d'`access-registry`/`incident-registry`, qui ne doivent **pas** régresser — même s'ils ne sont retrofit qu'au plan 02).
3. `POST /users` sans permission `manage:User` renvoie 403 ; avec la permission et un `roleId` valide, renvoie 200 et l'utilisateur créé porte le bon rôle.
4. L'UI de création utilisateur permet à un `tech_admin` connecté de choisir un rôle dans une liste alimentée par `GET /roles`, et masque ce champ pour tout autre rôle.
5. Une UI `/dashboard/roles` liste les 4 rôles, permet de créer un rôle, et d'éditer sa matrice action/subject via cases à cocher, avec persistance vérifiée par rechargement.
6. `lat check` passe et les nouvelles décisions (guard `requirePermission`, modèle de règles CASL en base, portabilité du module) sont documentées dans `lat.md/backend/permissions.md`.
7. Tous les tests listés dans la stratégie de tests passent en CI, **y compris la matrice de couverture par rôle** : chacun des 4 rôles (`encoder`, `dpo`, `auditor`, `tech_admin`) est exercé par au moins un utilisateur fixture et vérifié individuellement sur les actions guardées par ce plan — pas de rôle non couvert par la suite.
8. Un `tech_admin` peut créer un **nouveau** rôle depuis l'UI `/dashboard/roles` (pas seulement éditer les 4 rôles seedés), lui donner un nom/description, puis composer sa matrice de permissions — le nouveau rôle apparaît immédiatement dans le sélecteur de rôle du formulaire de création utilisateur sans redéploiement.
