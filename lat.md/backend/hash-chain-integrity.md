# Chaîne d'intégrité hash-chain partagée

Le registre d'accès et le registre d'incidents partagent la même primitive de chaînage cryptographique (hash-chain) définie dans `@libs/backend-shared`, garantissant qu'aucune ligne ne peut être falsifiée sans casser la chaîne.

Chaque table append-only (`access_record`, `incident`, `audit_event`) porte `seq`, `hash`, `prevHash`. Le hash d'un enregistrement = `sha256(prevHash + "||" + canonicalSerialize(record sans hash/prevHash))`. Le premier maillon référence `GENESIS_HASH` (64 zéros). Cette logique est centralisée une seule fois et réutilisée par `AppendService` (access-registry), `AppendService` (incident-registry) et `AuditAppendService` (audit-log) — décision d'architecture : ne pas dupliquer le chaînage par domaine.

`canonicalSerialize` ([[@libs/backend-shared/src/hash-chain/canonical.ts#canonicalSerialize]]) trie les clés récursivement et exclut `hash`/`prevHash` du calcul — nécessaire pour que la vérification retrouve un hash identique indépendamment de l'ordre d'insertion JS des propriétés.

L'insertion est protégée par un verrou consultatif Postgres (`pg_advisory_xact_lock`) avec une clé numérique dédiée par domaine : `1_000_000_001` (access-registry), `1_000_000_002` (audit-log), `1_000_000_003` (incident-registry) — pour sérialiser le calcul `seq`/`prevHash` sous concurrence et éviter les collisions de séquence.

[[@libs/backend-shared/src/hash-chain/hash-chain.ts#verifyChain]] rejoue toute la chaîne et renvoie `{brokenAt, reason}` sur le premier maillon incohérent (prevHash mismatch, hash mismatch) — utilisé à la fois par les routes `verify-integrity` de chaque registre et par leurs services d'export respectifs.

`incident-registry-backend` a son propre jeu de champs canoniques ([[@libs/incident-registry-backend/src/utils/integrity.ts#incidentCanonicalFields]]) — toute évolution du schéma incident doit mettre à jour cette liste sous peine de rompre silencieusement la vérification de chaîne pour les nouveaux enregistrements (les anciens restent valides avec l'ancien jeu de champs, aucune migration de re-hash n'existe).

## Défense en profondeur : triggers Postgres append-only

En plus du chaînage applicatif, des triggers Postgres bloquent physiquement tout UPDATE/DELETE/TRUNCATE sur `access_record`, `incident` et `audit_event` — deuxième ligne de défense contre une modification hors application.

`forbid_mutation()` (fonction PL/pgSQL définie dans [[@apps/backend/src/cli/append-only.sql.ts#APPEND_ONLY_DDL]]) lève une exception sur toute tentative de mutation ; les triggers sont créés de façon idempotente (`IF NOT EXISTS` sur `pg_trigger`) pour supporter les re-runs de migration/schema-fresh.

Décision explicite : la garantie d'immuabilité ne repose pas uniquement sur la discipline applicative (`AppendService`) — un accès direct psql ou un bug de migration ne peut pas casser la chaîne, car la DB elle-même refuse la mutation. Testé côté access-registry (`@libs/access-registry-backend/tests/integration/verify-integrity.route.test.ts`) : `UPDATE`/`DELETE` directs déclenchent bien l'exception du trigger.
