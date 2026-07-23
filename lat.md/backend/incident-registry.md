# Incident Registry — règles métier backend

Règles métier spécifiques au registre d'incidents (`@libs/incident-registry-backend`), qui réutilise le hash-chain générique ([[hash-chain-integrity]]) mais avec ses propres champs canoniques et son propre workflow.

## Référence et séquence annuelle globale

La référence métier d'un incident (`INC-{année}-{seq4}-{clientCode}`) est générée par [[@libs/incident-registry-backend/src/utils/append.service.ts#AppendService]], protégée par un verrou advisory Postgres dédié (`1_000_000_003`, distinct de celui d'access-registry et d'audit-log).

Point contre-intuitif : la séquence à 4 chiffres est **annuelle globale**, pas par client — elle cherche tous les enregistrements dont la référence commence par `INC-{year}-`, sans filtrer par `clientCode`, malgré la présence du code client en suffixe de la référence.

Toute évolution du schéma incident doit mettre à jour la liste de champs canoniques dans [[@libs/incident-registry-backend/src/utils/integrity.ts#verifyIncidentChain]], sous peine de rompre silencieusement la vérification de chaîne pour les nouveaux enregistrements (les anciens restent valides avec l'ancien jeu de champs — aucune migration de re-hash n'existe).

## RBAC plus strict qu'access-registry

Le registre incidents est intégralement append-only : aucune route de modification/clôture n'existe, `status` est fixé définitivement à la création par l'`encoder`.

`tech_admin` reçoit un 403 sur tout le préfixe `/incidents` ([[@libs/incident-registry-backend/src/init.ts#Module]]). Création réservée à `encoder` ([[@libs/incident-registry-backend/src/routes/create.route.ts#CreateRoute]]). Lecture et export accessibles à tout rôle sauf `tech_admin`. Vérification d'intégrité ([[@libs/incident-registry-backend/src/routes/verify-integrity.route.ts#VerifyIntegrityRoute]]) réservée à `auditor` et `dpo` — l'`encoder` qui alimente la chaîne ne peut pas la vérifier lui-même, contrairement aux routes de lecture/export ouvertes plus largement.

Comme pour access-registry, ces checks passent par `request.ability` (CASL) plutôt que par comparaison de string — cf. [[access-registry#Guard de groupe CASL sans requirePermission générique]] pour le pattern du guard de groupe (même logique ici avec le subject `Incident`), et [[permissions#Attachement de request.ability au chargement de l'utilisateur]] pour l'origine de `request.ability`.

## Guards manquants comblés sur list/get/export/export-one

`list`/`get`/`export`/`export-one` n'avaient aucun `requirePermission` propre — seuls `create.route.ts` et `verify-integrity.route.ts` en portaient un. Le hook de groupe ne bloque que `tech_admin` nommément.

Un futur rôle custom sans droit `read Incident` aurait pu lister/consulter/exporter tout le registre incidents (cf. [[access-registry#Guard de groupe CASL sans requirePermission générique]] pour le pattern du hook de groupe). Corrigé en ajoutant `preHandler: [requirePermission("read", "Incident")]` aux quatre routes. Cela a nécessité de seeder une règle `read Incident` pour `encoder`/`dpo`/`auditor` (absente jusqu'ici — seul `encoder` avait `create Incident`), sans quoi le guard aurait bloqué à tort ces trois rôles qui pouvaient lire le registre avant ce correctif (cf. [[permissions#Seed des 4 rôles avec permissions équivalentes au comportement actuel]]). Contrairement à access-registry, cette règle `read Incident` n'est pas conditionnée par `encodedBy` — `encoder` lit tout le registre incidents, pas seulement ses propres incidents. Testé par la matrice `describe.each` de [[@libs/incident-registry-backend/tests/integration/permission-separation.test.ts]].

## Validation métier à la création

Deux règles serveur imposent une cohérence que le front ne reproduit pas entièrement (voir [[incident-registry-contract-gaps]]).

`incidentEndAt >= incidentStartAt` et `resolvedAt >= detectedAt`, sinon 400 `INCOHERENT_DATES`. Quand `specialCategoryData=true` (données personnelles impactées, art. 9), le backend exige `severityOverall` **et** `severityCompliance` renseignés, plus au moins un des deux compteurs d'affectés non nul, sinon 400 `MISSING_IMPACT_FIELDS` — tout ceci dans [[@libs/incident-registry-backend/src/routes/create.route.ts#CreateRoute]]. `apdNotificationRequired` (notification CNIL, art. 33) reste un booléen libre non contraint côté serveur, laissé à l'appréciation de l'encodeur.

Les enums métier (`classification`, `status`, `environment`, `severity`) sont dupliqués à l'identique front/back plutôt que centralisés comme les référentiels access-registry ([[access-record-options#Référentiels dynamiques vs enum statique]]) — aucun référentiel backend n'existe pour ces champs incident.

## Champs texte long : p.text() requis pour legalContext/description/conclusion

`legalContext`, `description` et `conclusion` sur [[@libs/incident-registry-backend/src/entities/incident.entity.ts#IncidentEntity]] doivent être `p.text()`, pas `p.string()` (= `varchar(255)`).

Les données réelles de ce type de champ (contexte légal, description d'incident, conclusion) dépassent couramment 255 caractères — le seed `incidentOCM` atteint 778 caractères sur `conclusion`. Erreur observée sinon : `DriverException: value too long for type character varying(255)` au premier insert dépassant la limite, uniquement au runtime (aucune erreur de type ou de lint) — bloque `pnpm dev` en entier puisque le seeder plante avant que le serveur ne démarre.

## Export PDF à 10 sections

[[@libs/incident-registry-backend/src/utils/export-incident-pdf.ts#buildIncidentPdf]] génère un rapport structuré en 10 sections fixes (objet légal, infos générales, description, impact, chronologie, causes, mesures par phase, conclusion, annexe logs d'accès si non vide, signatures) — gabarit distinct de celui du registre d'accès.

Le bandeau "CONFIDENTIEL" apposé sur chaque page est codé en dur, indépendamment de la valeur réelle du champ `classification` — pas conditionné par `classification === 'CONFIDENTIEL'`, état constaté plutôt que garanti stable. Deux formats d'export existent : registre complet (json/csv/pdf) et export unitaire détaillé ([[@libs/incident-registry-backend/src/routes/export-one.route.ts#ExportOneRoute]]) ; le manifeste signé HMAC réutilise le mécanisme générique déjà documenté pour access-registry ([[access-registry#Export signé multi-format (JSON/CSV/PDF)]]).

## Édition = nouvelle version (append)

Éditer un incident n'écrase jamais la ligne existante : on **ajoute une nouvelle version chaînée** (même `reference`, `revision + 1`) ; l'original reste immuable.

[[@libs/incident-registry-backend/src/utils/append.service.ts#AppendService]]`#appendNewVersion` préserve l'identité d'origine (`encodedBy`/`encodedAt`) et enregistre l'éditeur dans `updatedBy`/`updatedAt`. `reference` n'est donc plus contrainte unique (plusieurs versions la partagent) ; l'unicité de la chaîne reste portée par `seq`. La **version courante** d'une référence est celle dont `supersededById` est `null` ; les colonnes lifecycle (`revision`, `supersededById`, `updatedBy`, `updatedAt`, `deletedAt`, `deletedBy`) sont **hors** de [[@libs/incident-registry-backend/src/utils/integrity.ts#incidentCanonicalFields]] → elles n'affectent pas le hash et `verifyIncidentChain` reste valide. `PUT /incidents/:id` ([[@libs/incident-registry-backend/src/routes/update.route.ts#UpdateRoute]]) garde `update Incident` (row-level `encodedBy=$user.id` pour l'encoder, inconditionnel pour le dpo) et refuse d'éditer une version non courante ou supprimée (409).

> Contrainte : la table `incident` est append-only pour son **contenu** uniquement. Le trigger `incident_no_mutation` (fonction `forbid_incident_content_mutation`, [[@apps/backend/src/cli/append-only.sql.ts#APPEND_ONLY_DDL]]) autorise en `UPDATE` seulement les colonnes lifecycle (`revision`, `superseded_by_id`, `updated_by`, `updated_at`, `deleted_at`, `deleted_by`) et lève une exception dès qu'une colonne de contenu change ; `DELETE`/`TRUNCATE` restent interdits (`incident_no_delete`/`incident_no_truncate`, fonction `forbid_mutation`). Ce trigger est désormais posé **en prod** (schema-fresh) comme en test ([[@libs/incident-registry-backend/tests/utils/append-only-test.sql.ts#APPEND_ONLY_DDL_TEST]]) — il manquait côté prod. Le hash n'étant calculé que sur les champs canoniques, la mutation lifecycle ne casse pas [[hash-chain-integrity]].

## Suppression = soft-delete + restauration

La suppression est un **soft-delete** (pas de `DELETE` physique) : la ligne reste en base, marquée `deletedAt`/`deletedBy`, et sort de la liste par défaut.

`DELETE /incidents/:id` ([[@libs/incident-registry-backend/src/routes/delete.route.ts#DeleteRoute]]) pose ces colonnes lifecycle (hors hash) et garde `delete Incident` (row-level : encoder = les siens, dpo = tous).

La restauration ([[@libs/incident-registry-backend/src/routes/restore.route.ts#RestoreRoute]], `POST /incidents/:id/restore`) est **réservée au DPO** (action CASL `restore Incident`) et efface `deletedAt`/`deletedBy`. La liste inclut les supprimés uniquement via `filter[includeDeleted]=true` + droit `restore` (dpo).

## Audit et enrichissement des noms

Actions tracées propres à ce module : `INCIDENT_CREATED`, `INCIDENT_VIEWED` (get et list, `targetType` diffère), `INCIDENT_EXPORTED` (export registre et unitaire).

Les actions de cycle de vie `INCIDENT_UPDATED`, `INCIDENT_DELETED`, `INCIDENT_RESTORED` sont journalisées dans `audit_event` (table immuable, trigger-protégée) — c'est le socle de traçabilité « qui a modifié/supprimé ».

Le nom d'utilisateur affiché (`encodedByName`) est résolu à la volée depuis `@libs/users-backend` par [[@libs/incident-registry-backend/src/utils/incident-enrichment.ts#serializeIncidentsWithUserNames]] — pas stocké en base, recalculé à chaque requête de liste. Même pattern dupliqué à l'identique côté access-registry.
