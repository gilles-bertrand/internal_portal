# Plan — Registre des incidents (RGPD / ITIL)

> Statut : `todo` · Cible : monorepo `internal_portal` (pnpm + Turbo)
> Construction : `/TPK-build specs/todo/registre-incidents-rgpd.md`
> **Méthode** : ce plan suit **à la lettre** les tutos `tuto/1_backend.md`, `tuto/0_frontend.md`,
> `tuto/2_sops.md`. Chaque étape reprend leur numérotation et leurs conventions.
> **Sources métier** : rapports Word Triptyk
> - `2026-02-20_Rapport_Incident_IPBW_INC-2026-0219.docx`
> - `2026-04-03_Rapport_Incident_OCM_INC-2026-0403.docx`

## 1. Énoncé du problème et objectifs

Centraliser dans le portail interne le **registre des incidents** (techniques, sécurité, données
personnelles) avec :

- une entrée de menu **« Registre d'incidents »** ;
- **liste** filtrable des incidents ;
- **création** via formulaire structuré (calqué sur les rapports Word existants) ;
- **consultation** en lecture seule ;
- **export PDF** :
  - rapport **unitaire** (équivalent du `.docx` officiel) ;
  - **registre** (liste synthétique de tous les incidents).

Le registre ne remplace pas la notification APD (art. 33 RGPD) mais produit les rapports internes
/ clients et garantit la **traçabilité** (append-only + chaîne de hash, réutilisation du noyau
existant dans `@libs/backend-shared`).

### Garanties héritées du registre d'accès

- TypeScript de bout en bout, logique métier dans la lib backend.
- Journal **append-only** + **chaînage de hash** (tamper-evident) ; pas de UPDATE/DELETE applicatif,
  **bloqué au niveau base** (triggers PostgreSQL).
- Auth JWT + RBAC existants (`users-backend`).
- Exports **signés HMAC** (`EXPORT_SIGNING_KEY` déjà en place).
- Méta-journal via `@libs/audit-log-backend` (`INCIDENT_CREATED`, `INCIDENT_VIEWED`,
  `INCIDENT_EXPORTED`).

## 2. Conventions imposées par les tutos (à respecter, ne pas réinventer)

D'après `tuto/1_backend.md` (« Règles globales backend ») :

- Chaque lib backend = **module Fastify** implémentant `ModuleInterface` de `@libs/backend-shared`.
- Réponses **JSON:API** (`makeJsonApiDocumentSchema`, `makeSingleJsonApiTopDocument`, `makeJsonApiError`).
- Validation **Zod** dans les schémas de routes (`fastify-type-provider-zod`).
- Chaque route = **classe** `Route`, **un fichier par route**.
- Tests d'intégration sur **PostgreSQL** (`@testcontainers/postgresql`), isolation `aroundEach` +
  `em.begin()` / `em.rollback()`.
- Entités exportées dans `@apps/backend/src/app/database.connection.ts`.

D'après `tuto/0_frontend.md` (« Règles globales frontend ») :

- Pas de tests d'acceptance dans la lib (faits par `@apps/front`).
- Appels API **mockés** (MSW) dans les tests lib ; e2e = user stories (`@apps/e2e`).
- Traductions dans `@apps/front/app/translations/<lib>/<locale>.yaml` ; la lib n'exporte que des **clés**.

> ⚠️ **Advisory** : plan établi par lecture des tutos et de `@libs/access-registry-backend` /
> `@libs/access-registry-front`. Relire le fichier ciblé avant d'implémenter chaque étape.

## 3. Modèle métier (dérivé des Word)

### 3.1 Structure commune des rapports Word

| Section Word | Contenu |
|--------------|---------|
| En-tête | Référence, date rapport, version, classification, application, environnement, période, statut, auteur, destinataire, signaleur |
| §1 | Objet et cadre légal |
| §2 | Informations générales (application, service, version, dates, durées, responsables) |
| §3 | Description (+ sous-sections : code, documents…) |
| §4 | Impact (nature, personnes, art. 9, criticité) |
| §5 | Chronologie `{ date, heure, événement }[]` |
| §6 | Causes (immédiate + facteurs contributifs) |
| §7 | Mesures (correctifs immédiats, phases, préventives) |
| §8 | Plan de communication (optionnel — IPBW) |
| §9 | Conclusion (+ mention notification APD si art. 9) |
| Annexes | Logs d'accès (optionnel — OCM) |
| §10 | Signatures émetteur / destinataire |

### 3.2 Entité `IncidentEntity` (append-only + hash chain)

Réutilise le pattern `AccessRecordEntity` + `AppendService` + triggers `forbid_mutation`.

**Identité**

| Champ | Type | Notes |
|-------|------|-------|
| `id` | UUID | primary |
| `reference` | string unique | auto `INC-{YYYY}-{seq4}-{clientCode}` |
| `reportDate` | ISO | |
| `version` | string | ex. `1.0` |
| `classification` | enum | `CONFIDENTIEL`, `INTERNE`, `PUBLIC` |
| `status` | enum | `open`, `in_progress`, `resolved`, `closed` |
| `applicationName`, `applicationDetail` | string | |
| `environment` | enum | `production`, `staging`, `development` |
| `clientCode`, `clientName` | string | |
| `reportedBy` | string | signaleur (texte libre) |
| `encodedBy` | string | user.id |
| `recipientName`, `recipientOrg` | string | |

**Corps du rapport (texte + JSON)**

| Champ | Type | Section |
|-------|------|---------|
| `legalContext` | text | §1 |
| `serviceName`, `deployedVersion` | string | §2 |
| `incidentStartAt`, `incidentEndAt`, `detectedAt`, `resolvedAt` | ISO | §2 |
| `resolutionDurationMinutes` | int nullable | §2 |
| `technicalLeadId` | string nullable | §2 |
| `description` | text | §3 |
| `descriptionSections` | JSON nullable | §3 sous-blocs |
| `personalDataImpacted`, `specialCategoryData` | boolean | §2/§4 |
| `apdNotificationRequired` | boolean nullable | §9 |
| `impactSummary`, `impactDetails` | text / JSON | §4 |
| `severityOperational`, `severityCompliance`, `severityOverall` | enum nullable | §4 |
| `affectedPersonsCount`, `affectedPatientsCount` | int nullable | §4 |
| `immediateCause` | text | §6 |
| `contributingFactors` | JSON string[] | §6 |
| `correctiveActions` | JSON | `{ phase?, order, title, detail, completedAt? }[]` |
| `preventiveMeasures` | JSON string[] | §7 |
| `communicationPlan` | JSON nullable | §8 |
| `conclusion` | text | §9 |
| `timelineEvents` | JSON | §5 `{ date, time, event }[]` |
| `accessLogs` | JSON nullable | Annexe `{ date, user, email, files, count }[]` |
| `issuerSignature`, `recipientSignature` | JSON | §10 |

**Chaînage** : `seq`, `prevHash`, `hash`, `encodedAt` (comme access-record).

> MVP : timeline + access logs en **JSON embarqué** (pas de tables filles) pour livrer vite.

### 3.3 Génération référence

Format : `INC-{YYYY}-{seq4}-{clientCode}` — généré **serveur** à la création (advisory lock + dernier
seq annuel).

## 4. Architecture des libs

| Lib | Rôle |
|-----|------|
| `@libs/backend-shared` (existant) | hash-chain, canonical, verifyChain — **rien à recréer** |
| `@libs/incident-registry-backend` (neuf) | entité, AppendService, routes, serializers, export PDF, intégrité |
| `@libs/incident-registry-front` (neuf) | Ember : table, formulaire multi-sections, show, exports |
| `@libs/audit-log-backend` (existant) | journaliser actions sensibles |
| `@libs/users-backend` (existant) | RBAC — pas de MFA |
| `@apps/backend`, `@apps/front`, `@apps/e2e` | câblage, seeders, e2e |

### RBAC

| Rôle | Droits |
|------|--------|
| `encoder` | créer, lire tous, exporter PDF |
| `dpo` | idem + `verify-integrity` |
| `auditor` | lecture + `verify-integrity` + export |
| `tech_admin` | **403 sur `/incidents`** (séparation, comme access-records) |

---

## 5. Plan d'implémentation — Backend (suivre `tuto/1_backend.md`, étapes 1→17)

> Copier le squelette de `@libs/todos-backend` / `@libs/access-registry-backend`.
> **Pas d'étape 0 hash-chain** (déjà livré). **Pas de `update.route.ts` ni `delete.route.ts`**
> (registre immuable).

**Étape 1** — Créer `@libs/incident-registry-backend` :
`package.json` (`type: module`, exports `dist/`, deps `@libs/backend-shared`, `@libs/users-backend`,
`pdfkit` workspace), `tsconfig.json`, `tsdown.config.mts` (`dts: true`), `vitest.config.mts`
(projets « Unit Tests » threads / « Integration Tests » forks + `globalSetup`).
Structure `src/` (`index.ts`, `init.ts`, `context.ts`, `types.ts`, `entities/`, `routes/`,
`serializers/`, `utils/`) et `tests/` (`integration/`, `unit/`, `utils/setup-module.ts`,
`global-setup.ts`).

**Étape 3** — `src/entities/incident.entity.ts` (`defineEntity`/`p`, `InferEntity`).
Service d'append dans `src/utils/append.service.ts` (noyau hash-chain + génération `reference`).

**Étape 4** — `src/serializers/incident.serializer.ts` via `makeJsonApiDocumentSchema("incidents", …)` :
`SerializedIncidentSchema`, `jsonApiSerializeIncident`, `…Many`, `…SingleDocument`, `…ManyDocument`.
Enrichissement lecture liste : `encodedByName` (comme access-records).

**Étape 5** — `src/context.ts` : `LibraryContext { em, configuration: { jwtSecret, exportSigningKey } }`.

**Étape 6** — `src/init.ts` : `Module implements ModuleInterface`, routes sous `/incidents`,
`createJwtAuthMiddleware` en `preValidation`, hook `tech_admin` → 403, `handleJsonApiErrors`.

**Étape 7** — Routes (un fichier par route, classe `Route`) :

| Fichier | Méthode | Description |
|---------|---------|-------------|
| `create.route.ts` | `POST /` | encodeur+ — body JSON:API. Validations : dates cohérentes ; si `specialCategoryData` ⇒ champs impact requis ; `reference` **calculé serveur**. Passe par `AppendService`. |
| `list.route.ts` | `GET /` | filtres `filter[status|clientCode|specialCategoryData|search|from|to]`, `sort`, pagination `{ data, meta: { total } }`. Journalise `INCIDENT_VIEWED`. |
| `get.route.ts` | `GET /:id` | détail ; 404 JSON:API ; journalise vue unitaire. |
| `export.route.ts` | `POST /export` | PDF/CSV/JSON **registre** signé HMAC + manifeste (`integrityOk`, `chainHeadHash`, `contentSha256`). |
| `export-one.route.ts` | `POST /:id/export` | PDF **rapport unitaire** (sections §1–§10, layout `export-incident-pdf.ts`). |
| `verify-integrity.route.ts` | `GET /verify-integrity` | auditeur/DPO — `verifyChain` → `{ ok, total, brokenAt?, reason? }`. |
| **Pas de** `update.route.ts` / `delete.route.ts` | | immuable volontairement |

Utils associés :
- `src/utils/integrity.ts` — `verifyIncidentChain(records)` (réutilise `canonicalSerialize` + `verifyChain`)
- `src/utils/export-registry-pdf.ts` — PDF liste (pattern `access-registry/export-pdf.ts`)
- `src/utils/export-incident-pdf.ts` — PDF rapport Word-like
- `src/utils/export.service.ts` — orchestration + HMAC

**Étape 8** — `src/index.ts` : barrel + `export const entities = [IncidentEntity]`.

**Étape 9** — Test unitaire serializer `tests/unit/incident.serializer.test.ts`.

**Étape 10** — `tests/global-setup.ts` : PostgreSQL testcontainers, schéma entités, **trigger append-only**
(DDL réutilisé de access-registry), seed users par rôle.

**Étape 11** — `tests/utils/setup-module.ts` : `TestModule.init()`, `generateBearerToken(userId, role)`,
`createIncident(data)`, isolation `aroundEach`.

**Étape 12** — Tests d'intégration (**bloquants**, cf. §7) :
- `create.route.test.ts`, `list.route.test.ts`, `get.route.test.ts`
- `export.route.test.ts`, `export-one.route.test.ts`
- `verify-integrity.route.test.ts`

**Étape 13** — Liaison app :
- entités dans `@apps/backend/src/app/database.connection.ts`
- `Module.init({ em, configuration })` dans `@apps/backend/src/app/app.ts`
- `await module.setupRoutes(fastify)` dans `app.router.ts`
- seeder `development.seeder.ts` : 2 incidents exemples (IPBW + OCM) calqués sur les Word

**Étape 14** — (optionnel) `mikro-orm.config.ts` local pour migrations dev.

**Étape 15** — `pnpm test` + `pnpm lint` verts dans `@libs/incident-registry-backend`.

**Étape 16** — `pnpm run api:types` (@apps/backend) pour mocks MSW typés front.

**Étape 17** — Raffaello.

---

## 6. Plan d'implémentation — Frontend (suivre `tuto/0_frontend.md`, étapes 1→17)

Lib **`@libs/incident-registry-front`** (gabarit `@libs/todos-front` / `@libs/access-registry-front`) :

**Ét. 1-3** — package + structure `src/` :
`index.ts` (`initialize`, `moduleRegistry()`, `forRouter`), `assets/`, `components/`, `http-mocks/`,
`services/`, `routes/`, `schemas/`, `changesets/`, `styles/` ;
`tests/` (`app.ts`, `test-helper.ts`, `utils.ts`).

**Ét. 4** — `src/schemas/incidents.ts` (schéma Warp Drive).

**Ét. 5** — routes + templates sous `src/routes/dashboard/incidents/` :

| Route | Fichiers |
|-------|----------|
| Liste | `index.gts` + `index-template.gts` |
| Création | `create.gts` + `create-template.gts` |
| Détail | `show.gts` + `show-template.gts` |

`forRouter` :
```ts
this.route('incidents', function () {
  this.route('create');
  this.route('show', { path: '/:incident_id' });
});
```
**Pas de route `edit`** (immuable).

Menu : ajouter lien dans `@apps/front/app/templates/dashboard.gts`
(`dashboard.sidebar.incidents` → `dashboard.incidents`).

**Ét. 6-8** — `changesets/incident.ts` ;
`components/forms/incident-form.gts` (formulaire **multi-sections** / stepper miroir §1–§10) ;
`components/forms/incident-validation.ts` (Zod : dates, art. 9, timeline min. 1 ligne si résolu).

**Ét. 9** — test intégration formulaire `tests/integration/incident-form-test.gts`.

**Ét. 10** — `services/incident.ts` (`createIncident` via `createRecord`) ;
`services/incident-export.ts` (`downloadRegistryPdf`, `downloadIncidentPdf` — pattern `registry-export.ts`).

**Ét. 11** — `http-mocks/incidents.ts` (`createOpenApiHttp` ou handlers manuels) ;
`http-mocks/all.ts`.

**Ét. 12** — test unitaire services avec MSW `tests/unit/incident-test.gts`.

**Ét. 13** — composants table + détail :
- `components/incident-table.gts` (`TpkTableGenericPrefab`) — colonnes : référence, client, application,
  statut, période, art. 9, date rapport ; boutons **Nouvel incident** + **Exporter registre PDF**.
- `components/incident-detail.gts` — affichage sections + bouton **Exporter rapport PDF**.

**Ét. 14** — Liaison app `@apps/front` :
- `initialize` + MSW handlers dans `app/routes/application.ts`
- `forRouter` dans `app/router.ts` (route `dashboard`)
- `@libs/incident-registry-front` dans `package.json`
- `IncidentSchema` dans `app/services/store.ts`
- `@source` CSS dans `app/styles/app.css`
- traductions `app/translations/incidents/fr-fr.yaml` + `en-us.yaml`
- clés menu dans `app/translations/dashboard/*.yaml`

**Ét. 15** — test acceptance `@apps/front/tests/acceptance/incident-acceptance-test.gts`
(création → liste → export PDF registre).

**Ét. 16** — e2e `@apps/e2e/tests/incident-e2e-test.gts` (login → créer incident → liste → export).

**Ét. 17** — Raffaello.

---

## 7. Stratégie de test

> Tests d'intégration **bloquants** ; pas de smoke test manuel à la place.

**Unitaires**

- Serializer incident (champs internes hash non mutables côté client).
- `verifyIncidentChain` (valide / hash falsifié / prevHash cassé).
- Validation Zod front (art. 9, timeline, dates).

**Intégration (`TestModule` + testcontainers)**

1. `POST /incidents` crée + chaîne (`seq=1`, `prevHash=GENESIS`), référence auto, JSON:API conforme.
2. 2e insert chaîné (`prevHash == hash précédent`).
3. `specialCategoryData=true` sans champs impact ⇒ 400.
4. Dates incohérentes (`resolvedAt` < `detectedAt`) ⇒ 400.
5. **Falsification** : UPDATE SQL hash ⇒ `verify-integrity` `ok:false`.
6. **Append-only DB** : UPDATE / DELETE / TRUNCATE ⇒ exception trigger.
7. **RBAC** : auditeur POST create ⇒ 403 ; tech_admin ⇒ 403 sur `/incidents`.
8. **Méta-journal** : create, list, export ⇒ `AuditEvent` chaîné.
9. **Export registre** : HMAC vérifiable, `manifest.integrityOk=true`, PDF `%PDF`.
10. **Export unitaire** : PDF contient sections attendues (test sur manifeste + taille buffer).
11. Seed IPBW + OCM : données alignées Word.

**Front** : intégration formulaire, unitaire service MSW, acceptance, e2e.

---

## 8. Secrets (suivre `tuto/2_sops.md`)

Réutiliser `EXPORT_SIGNING_KEY` et `JWT_SECRET` existants — **aucun nouveau secret obligatoire**.
Si besoin futur `INCIDENT_REFERENCE_PREFIX` : l'ajouter au schéma Zod `configuration.ts` + `.env.enc`
via `sops edit` (cf. tuto §2_sops).

---

## 9. Phases (ordre de build)

1. `@libs/incident-registry-backend` — entité, AppendService, create + list + get + tests chaîne.
2. Routes export (registre + unitaire) + PDF + tests HMAC / intégrité.
3. Route verify-integrity + branchement audit-log (`INCIDENT_*`).
4. `@libs/incident-registry-front` — schéma, routes, formulaire, table, show.
5. Services export front + boutons PDF.
6. Liaison app (backend + front + traductions + menu).
7. Seeder IPBW/OCM + acceptance + e2e.
8. `pnpm run api:types` + `pnpm turbo test` verts.

---

## 10. Critères de succès (vérifiables)

1. Menu **Registre d'incidents** visible ; liste, création, détail fonctionnels.
2. Formulaire couvre les champs des 2 Word (IPBW technique + OCM art. 9 / phases / annexes).
3. Référence `INC-YYYY-XXXX-CLIENT` générée automatiquement, unique.
4. Registre **append-only** : triggers DB + tests UPDATE/DELETE/TRUNCATE.
5. `verify-integrity` détecte altération (test UPDATE SQL).
6. Export **registre PDF** : tableau + attestation intégrité + HMAC.
7. Export **rapport PDF** : sections §1–§10 + chronologie + annexes si présentes.
8. Actions sensibles journalisées dans méta-journal chaîné.
9. Structure libs **conforme tutos** (`ModuleInterface`, JSON:API, `forRouter`, MSW).
10. `pnpm lint` et `pnpm turbo test` verts ; e2e happy-path vert.

---

## 11. Hors périmètre

- MFA/TOTP ; capture automatique depuis SIEM ; workflow signatures électroniques.
- Édition / versioning rapport (v1.1) — immuable en MVP ; correction = nouvel append lié si besoin futur.
- Notification APD automatisée ; envoi email client.
- Lien incident ↔ registre d'accès (phase ultérieure).

---

## Annexe — Mapping Word → champs (rappel)

### IPBW `INC-2026-0219`

| Word | Champ |
|------|-------|
| Référence | `reference` (auto) |
| 50 users email admin | `impactSummary`, `affectedPersonsCount` |
| Code défaillant / corrigé | `descriptionSections[]` |
| Plan communication §8 | `communicationPlan[]` |
| Chronologie | `timelineEvents[]` |

### OCM `INC-2026-0403`

| Word | Champ |
|------|-------|
| Données art. 9 | `specialCategoryData`, `personalDataImpacted` |
| Phase 1 / 2 | `correctiveActions[{ phase }]` |
| Criticité | `severityOverall`, `severityCompliance` |
| Annexe logs | `accessLogs[]` |
| Notification APD | `apdNotificationRequired`, `conclusion` |
