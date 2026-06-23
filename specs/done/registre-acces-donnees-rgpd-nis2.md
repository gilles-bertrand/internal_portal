# Plan — Registre des accès aux données personnelles (RGPD art. 30 + NIS2)

> Statut : `todo` · Cible : monorepo `internal_portal` (pnpm + Turbo)
> Construction : `/TPK-build specs/todo/registre-acces-donnees-rgpd-nis2.md`
> **Méthode** : ce plan suit **à la lettre** les tutos `tuto/1_backend.md`, `tuto/0_frontend.md`,
> `tuto/2_sops.md`. Chaque étape ci-dessous reprend leur numérotation et leurs conventions.

## 1. Énoncé du problème et objectifs

Plateforme web de **registre des accès aux données personnelles** : le personnel **encode
manuellement** chaque événement d'accès (qui, quoi, quand, pourquoi) pour la **traçabilité /
accountability RGPD** (art. 5.2, 30) et la **journalisation NIS2**.

Le registre ne stocke **jamais** les données personnelles des clients : uniquement des
**métadonnées d'accès** et des **références pseudonymisées**. Minimisation stricte.

### Garanties non négociables
- **TypeScript de bout en bout**, logique métier **découplée du framework**.
- Saisie **manuelle** (formulaire) uniquement.
- Auth **comptes locaux**, **Argon2id**, politique mot de passe + **verrouillage anti-bruteforce**,
  **RBAC**. **➡️ PAS de MFA/TOTP** (retiré sur demande) — on conserve l'auth **JWT existante**.
- Journal **append-only** + **chaînage de hash** (tamper-evident) ; aucun UPDATE/DELETE possible,
  **bloqué au niveau base**.

## 2. Conventions imposées par les tutos (à respecter, ne pas réinventer)

D'après `tuto/1_backend.md` (« Règles globales backend ») :
- Chaque lib backend = **module Fastify** indépendant implémentant `ModuleInterface` de
  `@libs/backend-shared`.
- Réponses **JSON:API** via les helpers de `@libs/backend-shared`
  (`makeJsonApiDocumentSchema`, `makeSingleJsonApiTopDocument`, `makeJsonApiError`).
- Validation **Zod** dans les schémas de routes (`fastify-type-provider-zod`).
- Chaque route = **classe** implémentant `Route`, un fichier par route.
- Tests d'intégration sur **vraie PostgreSQL** via `@testcontainers/postgresql`, isolation par
  `aroundEach()` + `em.begin()`/`em.rollback()`.
- Tests unitaires sans base.
- Entités exportées et enregistrées dans `@apps/backend/src/app/database.connection.ts`.

D'après `tuto/0_frontend.md` (« Règles globales frontend ») :
- Une lib ne fait **pas** de tests d'acceptance (faits par l'app) ; appels API **mockés** (MSW/vitest).
- Tests e2e = user stories (`@apps/e2e`).
- Traductions gérées par l'**app** (`@apps/front/app/translations/<lib>/<locale>.yaml`), les libs
  exportent des **clés**.

> ⚠️ **Advisory** : plan établi par lecture directe des fichiers de référence
> (`@libs/todos-backend`, `@libs/users-backend`, `@libs/todos-front`). Relire le fichier ciblé avant
> d'implémenter chaque étape.

## 3. Architecture fonctionnelle

Trois libs backend + une lib front, plus extensions de `users-backend` et câblage app :

| Lib | Rôle |
|---|---|
| `@libs/backend-shared` (étendu) | noyau **hash-chain pur** (canonical, `verifyChain`, rétention) — zéro I/O |
| `@libs/access-registry-backend` (neuf) | registre : `AccessRecordEntity`, AppendService, routes, serializer, intégrité, export, rétention |
| `@libs/audit-log-backend` (neuf) | méta-journal : `AuditEventEntity` (chaîné), service d'append, hook |
| `@libs/users-backend` (étendu) | `role`, lockout anti-bruteforce, middleware RBAC (**pas de MFA**) |
| `@libs/access-registry-front` (neuf) | Ember : formulaire saisie, table/filtre, dashboard, vue intégrité, export |
| `@apps/backend`, `@apps/front`, `@apps/e2e` | câblage, config, secrets SOPS, seeders, e2e |

### Décision auth (sans MFA)
On garde l'auth **JWT** existante (`login.route.ts`, `createJwtAuthMiddleware`, `argon2`). On ajoute :
- `role` sur `UserEntity` + claim `role` au login ;
- middleware `requireRole(...)` (RBAC) ;
- compteur d'échecs + verrouillage (`failedLoginAttempts`, `lockedUntil`) dans `login.route.ts` ;
- politique mot de passe (≥ 12 car.) à la création ;
- TTL access token court (« sessions courtes »).

### Noyau hash-chain pur (`@libs/backend-shared/src/hash-chain/`)
Framework-agnostique (aucun import Fastify/MikroORM) — exporté via le barrel `index.ts` :
```ts
export const GENESIS_HASH = "0".repeat(64);

export function computeRecordHash(prevHash: string, canonical: string): string {
  return createHash("sha256").update(prevHash + "||" + canonical).digest("hex");
}
// sérialisation canonique déterministe (clés triées, dates ISO UTC, exclut hash/prevHash)
export function canonicalSerialize(record: Record<string, unknown>): string { /* stableStringify */ }

export interface ChainLink { hash: string; prevHash: string; canonical: string; }
export function verifyChain(links: ChainLink[]): { brokenAt: number; reason: string } | null { /* … */ }

export function computeRetentionUntil(accessedAt: string, durationDays: number): string { /* … */ }
```

### Append-only au niveau base (tamper-evident)
`schema.refresh()` ne pose pas de trigger : ajouter un **runner SQL post-schéma**
(`@apps/backend/src/cli/append-only.sql.ts`) appelé après `schema.refresh()` dans
`@apps/backend/src/cli/schema-fresh.ts` :
```sql
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'append-only: % interdit sur %', TG_OP, TG_TABLE_NAME; END;
$$ LANGUAGE plpgsql;

-- Bloque les mutations ligne-à-ligne (UPDATE / DELETE)
CREATE TRIGGER access_record_no_mutation BEFORE UPDATE OR DELETE ON "access_record"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
-- Bloque aussi TRUNCATE (ne passe PAS par les triggers FOR EACH ROW) — sinon trou append-only
CREATE TRIGGER access_record_no_truncate BEFORE TRUNCATE ON "access_record"
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
-- idem pour audit_event (réutiliser la MÊME fonction forbid_mutation)
```
> **Défense en profondeur (moindre privilège)** : le trigger est la garantie dure mais un
> super-utilisateur Postgres peut le désactiver (`ALTER TABLE … DISABLE TRIGGER`) ou le supprimer.
> Le rôle applicatif utilisé par le backend (`registry_app`) ne doit donc disposer que de
> `INSERT, SELECT` sur `access_record` et `audit_event` — **sans** `UPDATE`/`DELETE`/`TRUNCATE`/
> `ALTER`/`TRIGGER`. Trigger + permissions restreintes = double rempart. À documenter dans le README
> et à provisionner via le script de setup base (`GRANT INSERT, SELECT ON … TO registry_app;`,
> `REVOKE UPDATE, DELETE, TRUNCATE ON … FROM registry_app;`).

### Append sérialisé (concurrence du chaînage)
Service dans chaque lib journal, transaction + verrou applicatif pour ordre total :
```ts
async append(em, payload) {
  return em.transactional(async (tx) => {
    await tx.execute("SELECT pg_advisory_xact_lock(hashtext('access_record_chain'))");
    const last = await tx.findOne(AccessRecordEntity, {}, { orderBy: { seq: "DESC" } });
    const prevHash = last?.hash ?? GENESIS_HASH;
    const seq = (last?.seq ?? 0) + 1;
    const record = { ...payload, seq, prevHash };
    const hash = computeRecordHash(prevHash, canonicalSerialize(record));
    return tx.insert(AccessRecordEntity, { ...record, hash });
  });
}
```

## 4. Modèle de données

`AccessRecordEntity` (`defineEntity` + `p`, cf. tuto backend étape 3) :
`id` (UUID, primary), `seq` (int, unique — ordre d'append), `accessedAt`, `encodedAt`, `encodedBy`,
`accessorRef`, `dataSubjectRef` (pseudonyme stable), `dataCategories` (array), `isSpecialCategory`
(bool, art. 9), `accessType` (`consultation|modification|export|transmission`), `purpose`,
`legalBasis`, `sourceSystem`, `recipient` (nullable), `justification`, `retentionUntil`,
`prevHash`, `hash` (unique). Index : `dataSubjectRef`, `encodedBy`, `accessedAt`, `isSpecialCategory`,
`accessType`, `purpose`.

`AuditEventEntity` (méta-journal, chaîné) : `id`, `seq`, `occurredAt`, `actorId`, `action`
(`LOGIN`/`LOGIN_FAILED`/`USER_CREATED`/`REGISTRY_VIEWED`/`REGISTRY_EXPORTED`/`RETENTION_PURGE`…),
`targetType`, `targetRef`, `outcome`, `ip`, `userAgent`, `prevHash`, `hash`.

Référentiels mutables (CRUD DPO) : `DataCategoryEntity`, `PurposeEntity`, `LegalBasisEntity`,
`RetentionPolicyEntity` (`category`, `durationDays`).

Extension `UserEntity` : `role` (`encoder|dpo|auditor|tech_admin`), `failedLoginAttempts`,
`lockedUntil`, `passwordChangedAt`.

### RBAC
- **Encodeur** : `POST /access-records`, lecture filtrée `encodedBy = self`.
- **DPO** : lecture complète, exports, CRUD référentiels + rétention.
- **Auditeur** : lecture seule globale + `verify-integrity`.
- **Admin technique** : gestion comptes (`/users`), **403 sur `/access-records`** (séparation).

---

## 5. Plan d'implémentation — Backend (suivre `tuto/1_backend.md`, étapes 1→17)

> Réaliser **deux passes** du gabarit du tuto : (A) `@libs/access-registry-backend`,
> (B) `@libs/audit-log-backend`. Plus une **étape 0** (noyau hash-chain) et une extension de
> `users-backend`. À chaque étape, copier le squelette de `@libs/todos-backend`.

**Étape 0 — Noyau hash-chain pur** dans `@libs/backend-shared/src/hash-chain/`
(`canonical.ts`, `hash-chain.ts`, `retention.ts`) + ré-export depuis `@libs/backend-shared/src/index.ts`.
Tests unitaires (cf. §7). Aucun import framework.

**Étape 1** — Créer le package `@libs/access-registry-backend` (puis `@libs/audit-log-backend`) :
`package.json` (`type: module`, exports `dist/`, dep `@libs/backend-shared` workspace), `tsconfig.json`,
`tsdown.config.mts` (`dts: true`), `vitest.config.mts` (projets « Unit Tests » threads / « Integration
Tests » forks + `globalSetup`). Structure `src/` (`index.ts`, `init.ts`, `context.ts`, `types.ts`,
`entities/`, `routes/`, `serializers/`, `middlewares/`, `utils/`) et `tests/`
(`integration/`, `unit/`, `utils/setup-module.ts`, `global-setup.ts`).

**Étape 3** — `src/entities/access-record.entity.ts` (`defineEntity`/`p`, type via `InferEntity`).
Le service d'append vit dans `src/utils/append.service.ts` (utilise le noyau hash-chain).

**Étape 4** — `src/serializers/access-record.serializer.ts` via `makeJsonApiDocumentSchema(
"access-records", …)` : exporte `SerializedAccessRecordSchema`, `jsonApiSerializeAccessRecord`,
`…Many`, `…SingleDocument`, `…ManyDocument`. **Ne pas exposer** de champ identifiant en clair.

**Étape 5** — `src/context.ts` : `LibraryContext { em, configuration: { jwtSecret, exportSigningKey } }`.

**Étape 6** — `src/init.ts` : classe `Module implements ModuleInterface`, `Module.init(context)`,
`setupRoutes(fastify)` groupe les routes sous `/access-records`, applique `createJwtAuthMiddleware`
en `preValidation` puis `requireRole(...)` par route, `f.setErrorHandler(handleJsonApiErrors)`.

**Étape 7** — Routes (un fichier par route, classe `Route`) :
- `create.route.ts` `POST /` (encodeur) — body `makeSingleJsonApiTopDocument(...)`. Validations :
  `recipient` requis si `accessType=transmission` ; base art. 9.2 requise si `isSpecialCategory` ;
  `retentionUntil` **calculé serveur**. Passe par `AppendService` (jamais `repository.create` direct).
- `list.route.ts` `GET /` — filtres `filter[dataSubjectRef|encodedBy|from|to|category|isSpecialCategory|accessType]`,
  `sort`, pagination ; renvoie `{ data, meta: { total } }` (pattern `users/list.route.ts`). RBAC :
  encodeur restreint à soi.
- `get.route.ts` `GET /:id` (404 JSON:API si absent).
- `verify-integrity.route.ts` `GET /verify-integrity` (auditeur/DPO) — rejoue `verifyChain`,
  renvoie `{ ok, total, brokenAt?, reason? }`.
- `export.route.ts` `POST /export` (DPO) — `csv|json|pdf` **signés** : `HMAC-SHA256(payload,
  EXPORT_SIGNING_KEY)` + manifeste (`generatedAt`, `generatedBy`, `count`, `chainHeadHash`,
  `sha256(payload)`). Journalise `REGISTRY_EXPORTED`. PDF via lib légère (`pdfkit`).
- `retention-run.route.ts` `POST /retention/run` (DPO) — archive signée des échus **avant** purge,
  event `RETENTION_PURGE` ; jamais de suppression silencieuse du journal.
- `stats.route.ts` `GET /stats` — volumes/période, part art. 9, par finalité, par type (agrégations SQL).
- **Pas de `update.route.ts` ni `delete.route.ts`** (registre immuable — c'est volontaire).
- Toute route de lecture du registre journalise `REGISTRY_VIEWED` (via `audit-log-backend`).

**Étape 8** — `src/index.ts` : barrel + `export const entities = [AccessRecordEntity, …référentiels]`.

**Étape 9** — Test unitaire serializer (`tests/unit/access-record.serializer.test.ts`) : champs
internes non exposés.

**Étape 10** — `tests/global-setup.ts` : conteneur PostgreSQL, schéma de toutes les entités du module
**+ trigger append-only** (rejouer le DDL §3), seed user de test par rôle, `TEST_DATABASE_URL`.

**Étape 11** — `tests/utils/setup-module.ts` : `TestModule.init()` (MikroORM → DB test, Fastify +
ZodTypeProvider, `Module.setupRoutes`), helpers `generateBearerToken(userId, role)`,
`createAccessRecord(data)`, `em`, `close()` ; isolation `aroundEach` begin/rollback.

**Étape 12** — Tests d'intégration (cf. §7, **bloquants**).

**Étape 13** — Liaison app : enregistrer `entities` dans
`@apps/backend/src/app/database.connection.ts` ; `Module.init({ em: orm.em.fork(), configuration })`
dans `@apps/backend/src/app/app.ts` ; `await module.setupRoutes(fastify)` dans `app.router.ts` ;
seeders (`development.seeder.ts` + `seedersList`) avec référentiels par défaut et comptes par rôle.

**Étape 16** — `pnpm run api:types` (régénère `openapi.json` + `src/api-types.ts`) — requis pour les
mocks MSW typés du front.

**Extension `users-backend`** (hors gabarit) : ajouter `role`/lockout à `UserEntity`, claim `role` au
login, `requireRole(...)` (`src/middlewares/role-guard.middleware.ts`), logique de verrouillage dans
`login.route.ts`, politique MdP dans `create.route.ts`. Tests d'intégration RBAC + anti-bruteforce.

**Méta-journal `audit-log-backend`** : hook `onResponse` + appels explicites (login, création compte,
consultation/export registre, purge) → `AuditAppendService`. Branché dans `app.ts`.

## 6. Plan d'implémentation — Frontend (suivre `tuto/0_frontend.md`, étapes 1→17)

Lib **`@libs/access-registry-front`** (gabarit `@libs/todos-front`) :
- **Ét. 1-3** — package + structure `src/` (`index.ts` avec `initialize(owner)`, `moduleRegistry()`,
  `forRouter(this: DSL)`), `assets/`, `components/`, `http-mocks/`, `services/`, `routes/`, `schemas/`,
  `changesets/`, `styles/` ; `tests/` (`app.ts` `TestApp`/`TestStore`/`initializeTestApp`,
  `test-helper.ts`, `utils.ts`).
- **Ét. 4** — `src/schemas/access-records.ts` (schéma Warp Drive).
- **Ét. 5** — routes + templates sous `src/routes/dashboard/access-records/`
  (`index`/`index-template`, `create`/`create-template`) + `dashboard/integrity/` + `dashboard/stats/`.
  Template = nom de route + `-template.gts`. **Pas de route `edit`** (immuable).
- **Ét. 6-8** — `changesets/access-record.ts` ; `components/forms/access-record-form.gts`
  (`TpkForm` de `@triptyk/ember-input-validation`, soumission via service, flash) ;
  `components/forms/access-record-validation.ts` (`createAccessRecordValidationSchema(intl)` Zod :
  `recipient` requis si transmission, base 9.2 si sensible).
- **Ét. 9** — test d'intégration du formulaire (`renderingTest` d'`ember-vitest`).
- **Ét. 10-12** — `services/access-record.ts` (`createAccessRecord(changeset)` via
  `createRecord` `@warp-drive/utilities/json-api`) ; `http-mocks/access-records.ts`
  (`createOpenApiHttp` d'`openapi-msw` sur les types backend) ; test unitaire du service avec MSW.
- **Ét. 13** — `components/access-record-table.gts` (`TpkTableGenericPrefab` de `@triptyk/ember-ui`),
  filtres, colonnes (sujet, catégories, type, sensible, date) ; vue dashboard/stats ; vue intégrité.
- **Ét. 14** — Liaison app `@apps/front` : `initialize` dans `app/routes/application.ts`, handlers MSW
  dans `setupWorker(...)`, `forRouter` injecté dans la route `dashboard` de `app/router.ts`, dep
  `workspace:*`, `Schema` ajouté dans `app/services/store.ts`, `@source` CSS dans `app/styles/app.css`,
  fichiers de traduction `app/translations/access-records/<locale>.yaml`.
- **Ét. 15** — test d'acceptance `@apps/front/tests/acceptance/access-record-acceptance-test.gts`
  (création → liste).
- **Ét. 16** — e2e `@apps/e2e/tests/access-record-e2e-test.gts` (user story : login → saisie →
  recherche). Étendre `E2ESeeder` avec comptes par rôle + référentiels.

## 7. Stratégie de test

> Les tests d'intégration ci-dessous sont des **critères de succès bloquants** ; ils ne peuvent pas
> être remplacés par un smoke test manuel.

**Unitaires (`@libs/backend-shared/hash-chain`)** : `canonicalSerialize` déterministe ; `verifyChain`
(valide ⇒ `null` ; champ altéré ⇒ `brokenAt` ; `prevHash` falsifié ⇒ détecté ; genèse) ;
`computeRetentionUntil`.

**Intégration (`TestModule` + testcontainers)** :
1. `POST /access-records` crée + chaîne (`seq=1`, `prevHash=GENESIS`), JSON:API conforme.
2. 2e insert chaîné (`prevHash == hash précédent`).
3. `transmission` sans `recipient` ⇒ 400 ; `isSpecialCategory` sans base 9.2 ⇒ 400.
4. **Falsification détectée** : `UPDATE` SQL d'un hash via session privilégiée de test ⇒
   `verify-integrity` `ok:false` + `brokenAt`.
5. **Append-only DB** : `UPDATE` / `DELETE` / `TRUNCATE` direct ⇒ exception trigger.
6. **RBAC** : encodeur ne voit que ses records ; auditeur POST ⇒ 403 ; admin technique ⇒ 403 sur
   `/access-records` ; DPO complet.
7. **Anti-bruteforce** : N échecs ⇒ `lockedUntil` ⇒ verrouillage.
8. **Méta-journal** : login, export, consultation registre ⇒ `AuditEvent` chaîné.
9. **Export** : signature HMAC vérifiable, manifeste cohérent, event `REGISTRY_EXPORTED`.
10. **Rétention** : purge des échus précédée d'archive signée + event `RETENTION_PURGE`, chaîne intacte.

**Front** : test intégration formulaire (validation/soumission), test unitaire service (MSW),
test d'acceptance (création→liste), e2e (`@apps/e2e`).

## 8. Secrets (suivre `tuto/2_sops.md`)

Nouveaux secrets `EXPORT_SIGNING_KEY` (+ `ACCESS_TOKEN_TTL` si paramétré) :
1. Ajouter au schéma Zod `@apps/backend/src/configuration.ts` (sinon `loadConfiguration()` plante).
2. `sops edit --input-type dotenv --output-type dotenv @apps/backend/.env.enc` pour les ajouter
   (et `.env.e2e.enc`). `.env.enc` doit contenir **toutes** les clés du schéma.
3. Ne jamais committer de valeur en clair.

## 9. Phases (ordre de build)

1. Noyau hash-chain pur + tests unitaires.
2. Trigger append-only + runner SQL + intégration `schema-fresh`.
3. `access-registry-backend` (entité, AppendService, routes read + create + verify-integrity) + tests.
4. `audit-log-backend` + hook + branchement actions sensibles.
5. Extension `users-backend` (rôles, lockout, RBAC) + tests.
6. Export signé + rétention + stats + tests.
7. `access-registry-front` + liaison app + acceptance + e2e.
8. Secrets SOPS + `api:types`.
9. README : modèle de menace + mapping RGPD art. 30 / NIS2.

## 10. Critères de succès (vérifiables, checkés avant `done/`)

1. Noyau `hash-chain` **framework-agnostique** (aucun import Fastify/MikroORM), 100 % couvert, tests verts.
2. `verify-integrity` **détecte toute altération** (test prouvant la détection après UPDATE SQL).
3. `UPDATE`/`DELETE`/`TRUNCATE` directs sur les tables de journal **échouent** au niveau base
   (triggers ligne + statement) ; rôle applicatif `registry_app` restreint à `INSERT`/`SELECT`. Testé.
4. Chaînage correct : 1er = `GENESIS_HASH`, suivants référencent le `hash` précédent ; sérialisation
   canonique déterministe (tests).
5. **RBAC** conforme : encodeur (ses records), DPO (complet + config), auditeur (lecture + intégrité),
   admin technique (**403 sur le contenu métier**) — tous testés. **Aucun accès sans rôle.**
6. **Anti-bruteforce** : verrouillage après N échecs (test). Argon2id + politique MdP ≥ 12 car.
7. Toute action sensible (login, création compte, consultation registre, export, purge) produit un
   **événement chaîné** dans le méta-journal append-only (tests).
8. Exports CSV/JSON/PDF **signés** + manifeste vérifiable ; export tracé (test).
9. Rétention : purge des échus précédée d'une **archive signée** et tracée ; jamais de suppression
   silencieuse (test).
10. Validations : `recipient` requis si `transmission`, base 9.2 si `isSpecialCategory`,
    `retentionUntil` calculé serveur (tests).
11. **Aucune donnée personnelle** hors références/pseudonymes ; rien de personnel dans URLs/logs/erreurs.
12. Structure des libs **conforme aux tutos** (`ModuleInterface`/`Route`/JSON:API/`defineEntity` backend ;
    `initialize`/`moduleRegistry`/`forRouter`/changeset/MSW front).
13. `pnpm lint` et `pnpm turbo test` **verts** ; e2e happy-path (login → saisie → recherche) vert.
14. README livré : modèle de menace + mapping RGPD art. 30 / NIS2.

## 11. Hors périmètre
MFA/TOTP (explicitement retiré) ; capture automatique des accès ; registre des traitements art. 30
complet / DSAR ; détection d'anomalies / alerting NIS2.
