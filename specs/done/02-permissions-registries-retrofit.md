# Migration des vérifications de rôle en dur vers CASL dans access-registry et incident-registry

## Problème

[[specs/todo/01-permissions-casl-foundation.md]] pose le module `permissions-backend` (CASL + rôles/règles en base) mais laisse intact le code existant : 9 points de contrôle répartis sur 7 fichiers d'`access-registry-backend` et `incident-registry-backend` comparent directement `user.role` à une string en dur. Ce plan les migre vers `request.ability.can(action, subject)`, sans changer le comportement observable (couvert par les tests d'intégration déjà existants sur ces deux registres).

Pré-requis : le plan 01 doit être fait et déployé (module `permissions-backend` disponible, `request.ability` attaché par le middleware JWT, seed des 4 rôles avec les règles définies ci-dessous).

## Mapping actuel → règles CASL {#Mapping}

| Fichier | Ligne(s) | Check actuel | Nouvelle règle (seed du plan 01) | Nouveau code |
|---|---|---|---|---|
| `access-registry-backend/src/init.ts` | 109-115 | `request.user?.role === "tech_admin"` → 403 sur tout le groupe | `cannot("manage", "AccessRecord")` pour `tech_admin`, `order: 10` | Guard de groupe : `requirePermission("read", "AccessRecord")` en préValidation (le hook générique bloque déjà `tech_admin` puisqu'il n'a aucun `can` sur `AccessRecord`, seulement un `cannot` explicite) |
| `access-registry-backend/src/routes/create.route.ts` | 61-66 | `user.role !== "encoder"` → 403 | `can("create", "AccessRecord")` pour `encoder` uniquement | `requirePermission("create", "AccessRecord")` en hook de route |
| `access-registry-backend/src/routes/get.route.ts` | 45 | `user.role === "encoder" && record.encodedBy !== user.id` → 403 | `can("read", "AccessRecord", { encodedBy: "$user.id" })` pour `encoder` ; `can("read", "AccessRecord")` (sans condition) pour `dpo`/`auditor` | `requirePermission("read", "AccessRecord")` au niveau route (autorise l'accès à la ressource) + vérification fine post-fetch : `if (!ability.can("read", "AccessRecord", record)) return 403` — nécessite de passer l'instance au `can` pour que CASL évalue la condition contre l'objet réel |
| `access-registry-backend/src/routes/list.route.ts` | 58, 62 | `user.role === "encoder"` → filtre `encodedBy: user.id` ; refuse le filtre `encodedBy` explicite pour non-encoder | Même règle que `get.route.ts` | Extraire la condition effective via `ability.rulesFor("read", "AccessRecord")` → si une règle porte `conditions.encodedBy`, l'appliquer comme filtre MikroORM (`{ encodedBy: interpolatedValue }`) ; sinon pas de filtre |
| `access-registry-backend/src/routes/verify-integrity.route.ts` | 34 | `user.role !== "auditor" && user.role !== "dpo"` → 403 | `can("read", "AccessRecordIntegrity")` pour `auditor` et `dpo` | `requirePermission("read", "AccessRecordIntegrity")` |
| `access-registry-backend/src/routes/retention-run.route.ts` | 52 | `user.role !== "dpo"` → 403 | `can("manage", "AccessRecordRetention")` pour `dpo` | `requirePermission("manage", "AccessRecordRetention")` |
| `incident-registry-backend/src/init.ts` | 61-65 | `request.user?.role === "tech_admin"` → 403 sur tout le groupe | `cannot("manage", "Incident")` pour `tech_admin`, `order: 10` | Guard de groupe analogue à `access-registry-backend/init.ts` |
| `incident-registry-backend/src/routes/create.route.ts` | 172-176 | `user.role !== "encoder"` → 403 | `can("create", "Incident")` pour `encoder` | `requirePermission("create", "Incident")` |
| `incident-registry-backend/src/routes/verify-integrity.route.ts` | 30 | `user.role !== "auditor" && user.role !== "dpo"` → 403 | `can("read", "IncidentIntegrity")` pour `auditor` et `dpo` | `requirePermission("read", "IncidentIntegrity")` |

Les `subject` `AccessRecordIntegrity`, `AccessRecordRetention`, `IncidentIntegrity` sont des noms d'action logiques distincts de `AccessRecord`/`Incident` — volontaire : vérifier l'intégrité d'un registre ou lancer une purge de rétention sont des capacités différentes de lire/créer son contenu, même si aujourd'hui les rôles autorisés se recoupent partiellement. Ça évite qu'un futur ajustement de "qui peut lire l'access-registry" élargisse accidentellement "qui peut lancer une purge RGPD".

## Étapes d'implémentation

1. **Middleware de groupe** — dans `access-registry-backend/src/init.ts` et `incident-registry-backend/src/init.ts`, remplacer le check `request.user?.role === "tech_admin"` par `requirePermission("read", "<Subject>")` (ou une garde plus permissive si certaines routes du groupe ont des actions différentes — vérifier qu'aucune route du groupe n'a besoin d'un accès que `requirePermission` de groupe bloquerait par erreur ; sinon garder le guard de groupe uniquement pour le blocage `tech_admin` et laisser chaque route affiner avec son propre `requirePermission`).
2. **Routes à check simple** (`create.route.ts` ×2, `verify-integrity.route.ts` ×2, `retention-run.route.ts`) — remplacer le bloc `if (user.role !== ...)` par un hook `preHandler: [requirePermission(action, subject)]` sur la définition de route, supprimer l'import/l'usage direct de `user.role`.
3. **Routes à condition row-level** (`get.route.ts`, `list.route.ts`) — ajouter un petit helper partagé (dans `permissions-backend` ou dans chaque lib consommatrice, à trancher en implémentation selon la généricité réelle du besoin) :
   ```ts
   function extractEqualityCondition(ability: AppAbility, action: string, subject: string, field: string): string | undefined {
     const rule = ability.rulesFor(action, subject).find((r) => r.conditions?.[field]);
     return rule?.conditions?.[field] as string | undefined;
   }
   ```
   Utiliser ce helper pour construire dynamiquement le filtre MikroORM à la place du `if (user.role === "encoder")` en dur. Pour `get.route.ts`, vérifier après fetch avec `ability.can(action, subject, record)` (CASL évalue les conditions contre l'objet réel — nécessite que `record` porte bien le champ `encodedBy` accessible directement, ce qui est déjà le cas).
4. Supprimer tous les imports de `UserRole`/comparaisons directes à `user.role` restants dans ces deux libs une fois la migration faite — `grep -rn "user.role" @libs/access-registry-backend @libs/incident-registry-backend` doit ne plus rien remonter en dehors des tests.
5. Mettre à jour les commentaires `// @lat:` pointant vers les anciennes sections de doc (`backend/access-registry.md`, section RBAC) pour référencer les nouvelles règles CASL documentées dans `backend/permissions.md`.

## Stratégie de tests (bloquant)

- **Non-régression** : la suite de tests d'intégration existante d'`access-registry-backend` et `incident-registry-backend` (déjà écrite pour le comportement `user.role`-based) doit passer à l'identique après migration, sans modification de ses assertions — seule la mécanique interne change. Si une assertion doit changer, c'est un signal que le seed du plan 01 ne reproduit pas fidèlement le comportement actuel : corriger le seed, pas le test.
- Ajouter un test explicite par subject logique (`AccessRecordIntegrity`, `AccessRecordRetention`, `IncidentIntegrity`) vérifiant qu'un rôle sans la permission correspondante reçoit 403, même s'il a par ailleurs `read` sur `AccessRecord`/`Incident` — pour verrouiller la séparation actée dans la note du mapping.
- Test de non-régression spécifique sur `get.route.ts`/`list.route.ts` : un `encoder` ne voit/n'accède qu'à ses propres enregistrements, un `dpo`/`auditor` voit tout.
- Ces tests sont bloquants avant de considérer ce plan terminé — pas de substitution par vérification manuelle.

## Critères de succès

1. `grep -rn "user\.role" @libs/access-registry-backend/src @libs/incident-registry-backend/src` ne renvoie plus aucun résultat (hors tests).
2. Toutes les routes listées dans le tableau de mapping utilisent `requirePermission(...)` ou `ability.can(...)` pour leur décision d'autorisation.
3. La suite de tests existante des deux registres passe sans modification d'assertions.
4. Les 3 nouveaux tests de séparation (`AccessRecordIntegrity`/`AccessRecordRetention`/`IncidentIntegrity`) passent.
5. `lat check` passe ; `backend/access-registry.md` et `backend/incident-registry.md` référencent le nouveau modèle de permissions au lieu des anciens checks en dur.
