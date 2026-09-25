# Registre d'accès — `accessorRef` en select d'utilisateurs + `sourceSystem` en référentiel creatable

## Contexte & périmètre

Deux améliorations du **formulaire du registre d'accès** (`@libs/access-registry-front/src/components/forms/access-record-form.gts`). Malgré la formulation initiale (« registre d'incident »), les champs `accessorRef` et `sourceSystem` vivent dans le **registre d'accès** — c'est bien ce formulaire qui est modifié (confirmé).

Aujourd'hui, les deux champs sont de simples `F.TpkInputPrefab` (texte libre) :
- `accessorRef` (ligne ~241) — validé `string().min(1)`
- `sourceSystem` (ligne ~294) — validé `string().min(1)`

### Objectifs

1. **`accessorRef`** devient une **select** listant les utilisateurs **habilités à enregistrer un record** (permission CASL `create AccessRecord`), avec **l'utilisateur courant sélectionné par défaut**. Décision produit : **on stocke le nom affiché** (« Prénom Nom ») — snapshot, cohérent avec un journal append-only, **zéro changement du contrat backend** (`accessorRef` reste `string`).
2. **`sourceSystem`** devient une **select adossée à un vrai référentiel backend** (`source-systems`) : choix parmi les systèmes existants **et** ajout d'un nouveau système (persisté et partagé), sur le modèle de `purposes`/`legal-bases`.

### Décisions actées (via clarification)

- Registre concerné : **registre d'accès**.
- `accessorRef` stocke le **nom affiché** (pas l'id).
- `sourceSystem` = **référentiel backend persistant** (nouvelle entité + routes GET/POST + seed).

### Point de vigilance sémantique (à confirmer au build, non bloquant)

`accessorRef` désigne RGPD-métier « la personne qui a accédé à la donnée ». Le défaut = utilisateur courant (= l'encodeur) **conflate encodeur et accédant**. C'est conforme à la demande, mais laisser la select **modifiable** (pas de valeur figée) pour couvrir le cas où l'accédant ≠ l'encodeur.

---

## Architectural Context

- **Communautés touchées** : `access-registry-backend`, `access-registry-front`, en lecture transverse `permissions-backend` (règles CASL) et `users-backend` (entité `User`).
- **Contrats à risque** :
  - `makeSingleJsonApiTopDocument` / `makeJsonApiDocumentSchema` (schémas de réponse JSON:API) — réutilisés tels quels pour le nouveau référentiel.
  - `CreateRoute` (`create.route.ts`) — le body `sourceSystem: string().min(1)` reste inchangé (on stockera le **code** du référentiel, comme `purpose`/`legalBasis`).
  - Chaîne d'intégrité append-only (`AppendService`, `integrity.ts`) — **ne pas modifier** ; `accessorRef`/`sourceSystem` restent de simples `string` dans le hash.
- **Découplage `permissions-backend`** : ne PAS importer de logique métier dans permissions-backend. La résolution « users habilités » se fait dans **access-registry-backend** (qui dépend déjà de `users-backend` et `permissions-backend`).

> Règle advisory : reconfirmer chaque emplacement par une lecture réelle du fichier avant d'éditer (les numéros de ligne ci-dessus sont indicatifs).

---

## Feature A — `accessorRef` : select des utilisateurs habilités (défaut = user courant)

### Phase A1 — Backend : endpoint « utilisateurs habilités »

**Pourquoi un nouvel endpoint** : `GET /users` (`@libs/users-backend/src/routes/list.route.ts`) est gardé `requirePermission("manage", "User")` — un encodeur ne peut pas l'appeler. Il faut un endpoint léger, accessible à quiconque peut créer un record, renvoyant le strict minimum (id + nom).

**Fichier** : `@libs/access-registry-backend/src/routes/eligible-accessors.route.ts` (nouveau)

- Route `GET /eligible-accessors`, guardée `preHandler: [requirePermission("create", "AccessRecord")]`.
- L'enregistrer dans `init.ts` → `registerReferentialRoutes` (groupe déjà pourvu du `authHook` JWT + hook anti-`tech_admin`).
- Logique de résolution des users habilités (approximation CASL suffisante pour peupler une liste — l'autorisation réelle reste sur le POST) :
  1. Charger les `PermissionRuleEntity` où `action ∈ {create, manage}`, `subject ∈ {AccessRecord, all}`, `inverted = false`.
  2. En déduire l'ensemble des `roleId` habilités ; retirer les rôles portant une règle `inverted` sur `manage AccessRecord` (cf. `tech_admin`).
  3. `UserEntity.find({ role: { $in: roleIds } }, { populate: ["role"] })`.
  4. Sérialiser `{ id, name: "${firstName} ${lastName}" }`.
- Réutiliser `userNameFor` de `#src/utils/user-display.js` pour le nom.

**Vérifs préalables au code** :
- Confirmer que `@libs/permissions-backend` exporte `PermissionRuleEntity` / `RoleEntity` (sinon les requêter par nom d'entité via l'`EntityManager`, toutes les entités étant enregistrées dans l'ORM de l'app).
- Confirmer le nom exact du subject utilisé dans les règles (« AccessRecord »).

**Réponse (nouveau serializer/inline)** :
```ts
// schema réponse
object({ data: array(object({
  id: string(), type: literal("eligible-accessors"),
  attributes: object({ name: string() }),
})) })
```

**Fallback documenté** : si la résolution par règles s'avère trop fragile, se rabattre sur « users dont `role.name ∈ {encoder, dpo, ...}` » — mais tracer explicitement le critère retenu.

### Phase A2 — Front : chargement, défaut, select

**Route** `@libs/access-registry-front/src/routes/dashboard/access-records/create.gts`
- Ajouter au `Promise.all` du `model()` : `query('eligible-accessors')`.
- Retourner `eligibleAccessors: [...].content.data` dans le modèle.
- Ajouter le type `EligibleAccessor` dans un nouveau schéma front `#src/schemas/eligible-accessors.ts` (mirror minimal de `purposes.ts` : champs `name`).

**Template** `create-template.gts`
- Injecter le service courant : `@service declare currentUser: CurrentUserService` (depuis `@libs/users-front/src/services/current-user.ts`).
  - **Vérif** : `access-registry-front` dépend-il de `users-front` ? Sinon, ajouter la dépendance workspace (le service est résolu globalement à l'exécution, mais l'import de type l'exige). Alternative : lire le profil via un service partagé si disponible.
- Initialiser le changeset avec le défaut : `new AccessRecordChangeset({ accessedAt: null, accessorRef: this.defaultAccessorName })` où `defaultAccessorName = \`${currentUser.currentUser.firstName} ${currentUser.currentUser.lastName}\``.
  - **Vérif** : forme exacte du type `User` (`@libs/users-front/src/schemas/users.ts`) — champs `firstName`/`lastName`.
- Passer `@eligibleAccessors={{@model.eligibleAccessors}}` au formulaire.

**Formulaire** `access-record-form.gts`
- Ajouter `eligibleAccessors: EligibleAccessor[]` aux `AccessRecordFormArgs`.
- Remplacer le `F.TpkInputPrefab` de `accessorRef` par un `F.TpkSelectPrefab` :
  - `@options` = getter `accessorOptions` = liste des noms (`string[]`), **value = label = nom** (on stocke le nom).
  - Pas de `@selectedItemComponent` custom nécessaire (option = string, comme `accessType`/`classification`).
  - `@placeholder` = clé i18n existante.
- **Validation** : `accessorRef` reste `string().min(1)` dans `access-record-validation.ts` — **aucun changement** (on stocke toujours une string non vide).

### Phase A3 — Tests Feature A (bloquants)

- **Backend intégration** (`@libs/access-registry-backend/tests/integration/eligible-accessors.route.test.ts`, nouveau) :
  - 200 + liste filtrée pour un user `create AccessRecord`.
  - 403 pour un user sans la permission.
  - `tech_admin` (règle `inverted`) exclu de la liste.
  - Suivre le harness testcontainer Postgres existant (cf. `tests/utils/setup-module.ts`).
- **Front** :
  - Unit/intégration : le formulaire pré-remplit `accessorRef` avec le nom du user courant.
  - La select propose bien les users habilités du modèle et met à jour le changeset.
  - Adapter le page-object : `accessorRef` n'est plus un `fillable` mais un trigger power-select (`openAccessor` clickable), à l'image de `openPurpose`.
  - Mettre à jour les acceptance tests existants (`tests/acceptance/…`) et http-mocks (`http-mocks/access-records.ts` + `all.ts`) pour mocker `GET /eligible-accessors`.

---

## Feature B — `sourceSystem` : référentiel backend creatable

### Phase B1 — Backend : entité, migration, seed, serializer

**Entité** `@libs/access-registry-backend/src/entities/source-system.entity.ts` (mirror `purpose.entity.ts`)
```ts
export const SourceSystemEntity = defineEntity({
  name: "SourceSystem",
  tableName: "source_system",
  properties: {
    id: p.string().primary(),
    code: p.string().unique(),
    label: p.string(),
  },
});
```
- L'enregistrer là où les entités du module sont déclarées pour MikroORM (config `mikro-orm` / liste d'entités de l'app — **vérifier** `@apps/backend` `mikro-orm.config.ts` et les entités exportées par `access-registry-backend/src/index.ts`).

**Migration** : générer une migration MikroORM créant `source_system` (`pnpm --filter ... migration:create` ou script projet — **vérifier** la commande de migration en place). Inclure un **seed** des systèmes initiaux « déjà choisis » (à lister avec l'utilisateur au build ; valeurs `code`/`label`). Suivre le pattern de seed des autres référentiels (`purpose`/`legal-basis`/`data-category`) — **localiser** leur seeder existant et y ajouter les source-systems.

**Serializer** : étendre `referential.serializer.ts`
- `SerializedSourceSystemSchema = makeJsonApiDocumentSchema("source-systems", object({ code: string(), label: string() }))`
- `jsonApiSerializeSourceSystem(e)` → `{ id, type: "source-systems", attributes: { code, label } }`.

### Phase B2 — Backend : routes GET + POST

**Fichier** `referentials.route.ts` (étendre) ou `source-systems.route.ts` (nouveau, plus propre car POST) :

- `GET /source-systems` — mirror `PurposesRoute` : `findAll({ orderBy: { label: "ASC" } })`. Enregistré dans `registerReferentialRoutes` (authHook seul, comme les autres GET référentiels).
- `POST /source-systems` — **création** :
  - Guard : `preHandler: [requirePermission("create", "AccessRecord")]` (créer un système est un acte d'encodage). *(À arbitrer au build : permission dédiée vs réutilisation de `create AccessRecord`.)*
  - Body `{ label: string().min(1) }`.
  - Générer `code` = slug de `label` (kebab/snake, minuscules, sans accents).
  - Gérer le doublon : si `code` existe déjà → renvoyer l'existant (idempotent) **ou** 409 `makeJsonApiError` — arbitrer ; recommandation : renvoyer l'existant pour une UX fluide.
  - Persister + renvoyer `makeSingleJsonApiTopDocument(SerializedSourceSystemSchema)`.
  - Enregistrer dans le groupe access-records (guardé) ou un sous-`register` dédié — **ne pas** le mettre dans le groupe référentiels non gardé.

### Phase B3 — Front : schéma, service, select creatable

**Schéma** `@libs/access-registry-front/src/schemas/source-systems.ts` (mirror `purposes.ts`) : `SourceSystem { code, label }`.

**Service** `@libs/access-registry-front/src/services/source-system.ts` (mirror `access-record.ts`) :
- Méthode `create(label: string): Promise<SourceSystem>` → POST `/source-systems`, renvoie le référentiel créé.

**Route** `create.gts` : ajouter `query('source-systems')` au `Promise.all`, retourner `sourceSystems`.

**Formulaire** `access-record-form.gts` — remplacer le `F.TpkInputPrefab` de `sourceSystem` par le pattern référentiel + création :
- État `@tracked sourceSystemOptions` initialisé depuis `@sourceSystems` (options `{ value: code, label }` via `referentialOption`, comme `purpose`).
- `TpkSelectPrefab` avec `@options`, `@onChange={{this.setSourceSystem}}` (stocke le **code** dans le changeset), `@selectedItemComponent` (résout le label depuis les options).
- **Création (pas d'addon creatable disponible)** : affordance « ＋ Ajouter un système » à côté de la select :
  - Un petit input + bouton (ou un `@onCreate`/search box si `TpkSelect`/power-select l'expose — **vérifier** l'API réellement dispo ; sinon fallback input+bouton).
  - Au submit de l'ajout : `await this.sourceSystem.create(label)` → pousser le nouveau `{value,label}` dans `sourceSystemOptions` (tracked) → `changeset.set('sourceSystem', newCode)` (sélection auto).
  - Gérer l'erreur via `flashMessages` (pattern `handleSave`/existants).
- **Validation** : `sourceSystem` reste `string().min(1)` (on stocke le code, non vide).

### Phase B4 — Tests Feature B (bloquants)

- **Backend intégration** (`tests/integration/source-systems.route.test.ts`, nouveau) :
  - `GET /source-systems` renvoie la liste triée.
  - `POST /source-systems` crée (code slugifié) + réponse 200/201.
  - Doublon → comportement arbitré (existant renvoyé ou 409).
  - 403 sans permission de création.
- **Front** :
  - La select propose les systèmes du modèle et stocke le code au changeset.
  - Le flux « ajouter un système » POST, ajoute l'option et la sélectionne.
  - Adapter page-object (`sourceSystem` : de `fillable` → trigger + affordance d'ajout), http-mocks (`GET`/`POST /source-systems`) et acceptance tests.

---

## Stratégie de test (récapitulatif — bloquant avant `done/`)

Les tests d'intégration backend (testcontainer Postgres) et les tests front (unit + acceptance) listés en A3 et B4 sont des **critères de succès bloquants** : ils ne peuvent pas être remplacés par une vérification manuelle. Respecter :
- Le harness backend existant (`tests/utils/setup-module.ts`, `fixtures.ts`).
- Le style dicté par le `.oxlintrc.json` de chaque lib (`@libs/CLAUDE.md`).
- Les conventions des skills `tpk-fastify-backend` et `tpk-ember-frontend`.

## Critères de succès (vérifiables)

1. `GET /access-records/eligible-accessors` (ou route équivalente) renvoie 200 + la liste des users habilités pour un encodeur, 403 sinon, et exclut `tech_admin`.
2. À l'ouverture du formulaire de création, `accessorRef` est **pré-rempli** avec le nom de l'utilisateur courant, et la select liste les users habilités ; le changeset stocke le **nom affiché**.
3. L'entité `SourceSystem` + sa table `source_system` existent (migration appliquée) et sont **seedées** avec les systèmes initiaux convenus.
4. `GET /source-systems` renvoie la liste ; `POST /source-systems` crée un système (code slugifié) et gère le doublon selon la règle arbitrée.
5. Le champ `sourceSystem` du formulaire est une **select** listant les systèmes existants + une affordance d'**ajout** qui persiste et sélectionne le nouveau système ; le changeset stocke le **code**.
6. Le contrat backend `POST /access-records` est **inchangé** (`accessorRef`/`sourceSystem` = `string().min(1)`), la chaîne d'intégrité n'est pas altérée.
7. `pnpm lint` et `pnpm lint:types` passent sur les deux libs touchées.
8. Tous les tests d'intégration backend et tests front (A3 + B4) passent.
9. `lat.md/` mis à jour (sections `frontend/access-record-options` / `backend/access-registry` : nouveau référentiel `source-systems` + select `accessorRef`) et `lat check` OK.

## Ordre de build recommandé

A1 → A2 → A3, puis B1 → B2 → B3 → B4. Les deux features touchent le **même fichier** `access-record-form.gts` : les construire **séquentiellement** (pas en parallèle) pour éviter les conflits. Feature A est plus simple (pas de migration) — bon point de départ pour valider le pattern select + tests avant d'attaquer le référentiel B.

## Risques & inconnues à lever au build

- **API creatable de `TpkSelect`/power-select** : confirmer s'il existe un `@onCreate` exploitable ; sinon retenir le fallback input+bouton (documenté ci-dessus).
- **Dépendance `access-registry-front` → `users-front`** (service `currentUser`) : à ajouter si absente.
- **Export `PermissionRuleEntity`/`RoleEntity`** par `permissions-backend` : à confirmer pour la Phase A1.
- **Commande de migration + emplacement des seeders** de référentiels : à localiser avant B1.
- **Liste exacte des source-systems initiaux** à seeder : à obtenir de l'utilisateur.
- **Subject CASL exact** (« AccessRecord ») et règles `inverted` de `tech_admin` : à confirmer dans le seed des rôles.
