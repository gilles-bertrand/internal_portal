# Registre d'incidents — édition (nouvelle version) + soft-delete/restore + audit (Backend)

## Contexte & décisions actées

Permettre d'**éditer** et de **supprimer** un incident, en traçant **qui a modifié/supprimé**, sans jamais casser l'intégrité du registre. Décisions prises avec l'utilisateur :

- **Édition = nouvelle version (append)** : l'original reste immuable ; éditer **ajoute une nouvelle ligne chaînée** partageant la même `reference`, avec `revision` incrémentée et un lien de supersession. La liste n'affiche que la version courante. La chaîne de hash reste valide (aucune ligne existante n'est modifiée dans ses champs canoniques).
- **Suppression = soft-delete** : pas de `DELETE` physique. On pose `deletedAt`/`deletedBy` (colonnes **hors champs canoniques** → n'affectent pas le hash). Restaurable.
- **Permissions** : `encoder` édite/supprime **ses propres** incidents (`encodedBy = user.id`) ; `dpo` gère **tout**. `tech_admin` reste banni. Restauration + visibilité des supprimés : **DPO uniquement**.
- **Journal d'audit** : chaque édition/suppression/restauration est journalisée dans `audit_event` (table **trigger-protégée / immuable**) — la preuve d'inaltérabilité repose sur ce journal + la chaîne de hash des versions.

> Ce spec (01) est le **prérequis contractuel** du spec frontend (02). À construire/merger avant, ou 02 s'appuie sur les mocks MSW.

## Point d'architecture (vérifié)

- La table `incident` **n'a AUCUN trigger append-only** (contrairement à `access_record`/`audit_event`) — cf. [[@apps/backend/src/cli/append-only.sql.ts#APPEND_ONLY_DDL]]. UPDATE est donc possible en DB. On l'exploite **uniquement** pour les colonnes **non canoniques** (lifecycle : supersession, soft-delete) ; le **contenu** reste immuable (toute édition de contenu = nouvelle ligne).
- Le hash couvre tout le contenu via [[@libs/incident-registry-backend/src/utils/integrity.ts#incidentCanonicalFields]]. **Ne pas** ajouter les nouvelles colonnes lifecycle à cette fonction → le hash des lignes existantes est inchangé, `verifyIncidentChain` reste vert.
- **Correctif doc** : `lat.md/backend/hash-chain-integrity.md` affirme à tort que `incident` a des triggers append-only. À corriger dans ce spec (il n'en a pas ; l'immuabilité du contenu repose sur la discipline applicative « édition = append » + la chaîne + le journal d'audit).

## Architectural Context

- **Communauté** : `incident-registry-backend` ; lecture transverse `audit-log-backend` (déjà câblé : `AuditLogger`/`AuditAppendService`), `permissions-backend` (CASL), `users-backend`.
- **Contrats à risque** :
  - `makeSingleJsonApiTopDocument` / `SerializedIncidentSchema` — ajout de champs lifecycle **optionnels**.
  - Chaîne de hash (`AppendService`, `verifyIncidentChain`) — invariant : champs canoniques inchangés.
  - Contrainte d'unicité sur `reference` — **doit être levée** (plusieurs versions partagent la référence). `seq` reste unique (chaîne globale).
  - Seed CASL (`development.seeder.ts`, `e2e.seeder.ts`, et le miroir de test `tests/utils/permission-rule-seed.ts` du registre incident si présent) — nouvelles actions.

## Phase 1 — Entité : colonnes lifecycle (non canoniques)

Dans [[@libs/incident-registry-backend/src/entities/incident.entity.ts#IncidentEntity]] :
- **Retirer** `.unique()` de `reference` (plusieurs versions par référence). `seq` reste `.unique()`.
- Ajouter (toutes nullable, **non canoniques**) :
  - `revision: p.integer().default(1)` — 1 à la création, +1 par édition.
  - `supersededById: p.string().nullable()` — id de la version qui remplace celle-ci ; `null` = version **courante**.
  - `updatedBy: p.string().nullable()`, `updatedAt: p.string().nullable()` — auteur/horodatage de la dernière version (édition).
  - `deletedAt: p.string().nullable()`, `deletedBy: p.string().nullable()` — soft-delete.
- **Ne pas** ajouter ces champs à `incidentCanonicalFields` (Phase 3 vérifie l'invariant hash).
- Schéma régénéré via `schema:update` (pas de migrations dans ce projet).

## Phase 2 — Append service : nouvelle version + soft-delete/restore

Dans [[@libs/incident-registry-backend/src/utils/append.service.ts#AppendService]] :
- `append(input)` existant (création v1) : initialiser `revision = 1`, `supersededById = null`.
- Nouveau `appendNewVersion(previous, editedInput, editorId)` :
  1. Sous le **verrou consultatif** existant (`ADVISORY_LOCK_KEY = 1_000_000_003`).
  2. Vérifier `previous.supersededById === null` et `previous.deletedAt == null` (on n'édite que la version courante non supprimée) — sinon erreur (409/400).
  3. Calculer `seq`/`prevHash` comme un append normal (nouvelle ligne en queue de chaîne), **même `reference`** que `previous` (ne PAS appeler `nextAnnualSequence`), `revision = previous.revision + 1`, `updatedBy = editorId`, `updatedAt = now`, `encodedBy` conservé = créateur d'origine.
  4. Calculer le `hash` sur les champs canoniques du nouveau contenu.
  5. Insérer la nouvelle ligne ; **UPDATE** `previous.supersededById = newRow.id` (champ non canonique → chaîne intacte).
  6. Retourner la nouvelle ligne.
- Helpers soft-delete (peuvent vivre dans le service ou la route) : `softDelete(currentRow, byUserId)` (set `deletedAt`/`deletedBy`), `restore(row)` (clear). UPDATE de champs non canoniques uniquement.

## Phase 3 — Intégrité inchangée + test d'invariant

- `incidentCanonicalFields` **inchangée**.
- Test bloquant : après `appendNewVersion`, `verifyIncidentChain(allRows)` reste `ok: true` (la nouvelle version est un maillon valide ; les anciennes lignes ont un hash inchangé). Un soft-delete (UPDATE deletedAt) ne casse pas non plus la chaîne.

## Phase 4 — Routes

Fichiers nouveaux dans `@libs/incident-registry-backend/src/routes/`, enregistrés dans [[@libs/incident-registry-backend/src/init.ts#Module]] (mêmes hooks : JWT + anti-`tech_admin`).

1. **`update.route.ts` — `PUT /incidents/:id`** (édition = append version)
   - `preHandler: [requirePermission("update", "Incident")]`.
   - Charger la ligne `:id` ; 404 si absente. Vérifier via CASL row-level `ability.can("update", subject("Incident", record))` (condition `encodedBy=$user.id` pour l'encoder) → 403 sinon.
   - Refuser si `record.supersededById !== null` (pas la version courante) ou `record.deletedAt != null` → 409.
   - Body = mêmes attributs que `create.route.ts` (contenu complet de l'incident).
   - `appendNewVersion(record, attrs, user.id)`.
   - Audit : `INCIDENT_UPDATED` (`actorId`, `targetType:"incident"`, `targetRef: reference`, meta `{ revision, fromId, toId }`).
   - Réponse : `makeSingleJsonApiTopDocument(SerializedIncidentSchema)` (nouvelle version).

2. **`delete.route.ts` — `DELETE /incidents/:id`** (soft)
   - `preHandler: [requirePermission("delete", "Incident")]` + row-level (encoder own / dpo all).
   - Refuser si déjà supprimé (idempotent : renvoyer 200/204). Sinon set `deletedAt`/`deletedBy`.
   - Audit : `INCIDENT_DELETED`.
   - Réponse : 200 (incident soft-supprimé) ou 204.

3. **`restore.route.ts` — `POST /incidents/:id/restore`** (DPO only)
   - `preHandler: [requirePermission("restore", "Incident")]` (action réservée dpo au seed).
   - Clear `deletedAt`/`deletedBy`. Audit : `INCIDENT_RESTORED`. Réponse : 200.

4. **`list.route.ts`** (modifier) : par défaut, ne renvoyer que les **versions courantes non supprimées** — `where.supersededById = null` et `where.deletedAt = null`. Ajouter un paramètre `filter[includeDeleted]=true` **réservé** à `can("restore","Incident")` (dpo) qui inclut les supprimés. Conserver le filtre row-level existant.

5. **`get.route.ts`** (vérifier) : renvoyer la ligne demandée (utile pour préremplir l'édition) ; inclure les champs lifecycle.

## Phase 5 — Serializer / schéma de réponse

Dans [[@libs/incident-registry-backend/src/serializers/incident.serializer.ts#SerializedIncident]] : ajouter, **optionnels**, `revision`, `supersededById` (nullable), `updatedBy` (nullable), `updatedAt` (nullable), `deletedAt` (nullable), `deletedBy` (nullable), et les exposer dans la sérialisation. Optionnels pour ne pas casser create/list existants.

## Phase 6 — CASL (seed + miroir de test)

Dans `@apps/backend/src/seeders/development.seeder.ts` et `e2e.seeder.ts` (+ le miroir `permission-rule-seed.ts` des tests incident s'il existe) :
- `encoder` : `{ action:"update", subject:"Incident", conditions:{ encodedBy:"$user.id" } }`, `{ action:"delete", subject:"Incident", conditions:{ encodedBy:"$user.id" } }`.
- `dpo` : `{ action:"update", subject:"Incident" }`, `{ action:"delete", subject:"Incident" }`, `{ action:"restore", subject:"Incident" }`.
- `tech_admin` : inchangé (`manage Incident` inverted couvre déjà update/delete/restore → banni).

## Stratégie de test (bloquant avant `done/`)

Tests d'intégration (testcontainer Postgres, harness incident existant) :
1. `PUT /incidents/:id` par l'encoder propriétaire → 200, **nouvelle ligne** (revision 2), l'ancienne a `supersededById` renseigné, `verify-integrity` reste **ok**.
2. `PUT` par un autre encoder → 403 ; `PUT` sur une version non courante ou supprimée → 409.
3. `DELETE /incidents/:id` (soft) par le propriétaire → l'incident **disparaît de la liste**, `deletedBy` renseigné, la ligne **existe toujours** en base.
4. `list` : ne renvoie que les versions courantes non supprimées ; `filter[includeDeleted]=true` par un dpo inclut les supprimés ; par un encoder → ignoré/403.
5. `POST /:id/restore` par dpo → réapparaît ; par encoder → 403.
6. Audit : `INCIDENT_UPDATED`/`INCIDENT_DELETED`/`INCIDENT_RESTORED` écrits avec le bon `actorId`.

## Critères de succès (vérifiables)

1. Éditer un incident **ajoute une nouvelle version chaînée** (même `reference`, `revision+1`, `supersededById` posé sur l'ancienne) ; `verify-integrity` reste `ok`.
2. Aucune ligne existante n'a ses **champs canoniques** modifiés (hash inchangé) ; les colonnes lifecycle sont hors hash.
3. `DELETE` = **soft** (aucun DELETE physique) ; la ligne reste en base ; exclue de la liste par défaut.
4. `restore` (DPO) rétablit ; l'inclusion des supprimés dans la liste est **réservée au DPO**.
5. Row-level : encoder n'édite/supprime que les siens (403 sinon) ; dpo gère tout ; tech_admin banni.
6. `INCIDENT_UPDATED`/`INCIDENT_DELETED`/`INCIDENT_RESTORED` journalisés dans `audit_event` (immuable) avec l'acteur.
7. `reference` n'est plus contraint unique ; `seq` reste unique ; `schema:update` applique le schéma sans erreur.
8. `pnpm lint`/`lint:types` OK ; suite backend incident **verte** (existants + nouveaux).
9. `lat.md` à jour (section incident-registry : versioning/soft-delete/restore ; **correction** de la mention erronée des triggers sur `incident` dans `hash-chain-integrity`) et `lat check` OK.

## Risques / à confirmer au build

- **Contrat exposé au front** (spec 02) : forme de `PUT /incidents/:id` (body = incident complet) et de `DELETE`/`restore`. Figer ici.
- Levée de l'unique sur `reference` via `schema:update` — vérifier que MikroORM supprime bien la contrainte ; sinon action DBA.
- `nextAnnualSequence` ne doit **pas** être appelé pour une nouvelle version (réf. réutilisée).
- Concurrence : `appendNewVersion` et `softDelete` sous le verrou consultatif pour éviter deux versions courantes simultanées.
