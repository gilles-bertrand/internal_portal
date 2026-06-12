---
description: Build from a plan file, then move plan to done/
allowed-tools: Read, Write, Bash, Edit, Glob, Grep, Agent, Workflow, mcp__delegate__delegate_to
model: sonnet
argument-hint: [path-to-plan]
---

> **Démarrage** : affiche immédiatement `[TPK-build] 🤖 Modèle : sonnet` comme première ligne de sortie.

# Build

## Purpose

Implement a plan from `specs/todo/` into working code. After successful completion, the plan is moved to `specs/done/` to track progress. Pairs with `/TPK-plan`.

Deux modes d'exécution :
- **Linéaire** (par défaut) : implémentation séquentielle, routing single-agent (front→GLM, back→Sonnet).
- **Parallèle (workflow)** : auto-détecté pour les gros plans — implémente les work-units indépendantes en parallèle dans des git worktrees isolés, puis vérifie chacune avant merge.

## Variables

PATH_TO_PLAN: $ARGUMENTS

## Routing Rules

| Priorité détectée | Exécution | Modèle |
|---|---|---|
| `frontend` | `mcp__delegate__delegate_to` (provider: glm) | GLM glm-5.1 |
| `backend` | Direct sonnet | claude-sonnet-4-6 |
| `fullstack` | Backend direct (sonnet) puis frontend délégué (GLM) | Sonnet + GLM |

**Détection** — scanner le plan pour les mots-clés :
- Frontend : `users-front`, `shared-front`, `ember`, `.gts`, `.hbs`, `component`, `template`, `CSS`, `UI`, `Vite`, `Ember`, `addon`
- Backend : `fastify`, `users-backend`, `backend`, `api`, `endpoint`, `entity`, `MikroORM`, `seeder`, `route`, `migration`
- Si les deux familles sont présentes → `fullstack`

## Mode d'exécution — auto-détection

Après lecture du plan, décider **automatiquement** du mode (pas de flag, pas de question) :

**Activer le mode PARALLÈLE (workflow) si l'une de ces conditions est vraie :**
- Le plan contient **≥ 3 phases / work-units indépendantes** dont les ensembles de fichiers sont **disjoints** (aucun fichier partagé entre deux unités).
- Le plan est **fullstack** avec des pistes front et back **séparables** (le front ne dépend pas du code back écrit dans la même passe, ou la dépendance est seulement contractuelle via le plan).

**Sinon → mode LINÉAIRE** (comportement historique ci-dessous).

**Découpage en work-units** (mode parallèle) :
- Une work-unit = un sous-ensemble cohérent du plan + un ensemble de fichiers **disjoint** des autres unités.
- Partitionner par lib/module/répertoire pour garantir l'absence de conflits d'édition (ex. `@libs/backlog-front`, `@libs/projects-backend`, une route, un composant…).
- Si deux phases touchent les mêmes fichiers → les **fusionner dans une seule unité** (pas de parallélisme sur fichiers partagés).
- Si après partition il reste < 2 unités réellement indépendantes → retomber en mode LINÉAIRE.
- Chaque unité reçoit un `kind` (`frontend` | `backend`), un `slug`, une branche dédiée `build/<plan-slug>/<unit-slug>`, la liste de ses fichiers et ses instructions extraites du plan.

## Instructions

- If no path provided, check `specs/todo/` and ask which plan to build
- Create a git branch with the appropriate name and type prefix before building
- Read the entire plan before starting implementation
- Follow the plan's phases in order
- If build fails, leave the plan in `specs/todo/` for retry

## Workflow

1. **Locate the plan**
   - If PATH_TO_PLAN is provided, use it
   - Otherwise, list files in `specs/todo/` and ask user which to build

2. **Read and understand**
   - Read the plan file completely
   - Think through the implementation approach
   - Identify any potential issues before starting

3. **Detect priority & announce agents**
   - Scan the plan for frontend/backend keywords (see Routing Rules)
   - Avant toute implémentation, afficher le bloc d'annonce — n'afficher que les lignes correspondant à la priorité détectée :
     ```
     Agents lancés :
     - [frontend] 🤖 GLM (glm-5.1) via mcp__delegate    ← si frontend ou fullstack
     - [backend]  🤖 Sonnet (claude-sonnet-4-6) direct   ← si backend ou fullstack
     ```

3b. **Décider du mode d'exécution** ← nouvelle étape
   - Appliquer les règles de la section "Mode d'exécution — auto-détection".
   - Annoncer explicitement le mode retenu :
     ```
     Mode : LINÉAIRE
     ```
     ou
     ```
     Mode : PARALLÈLE (workflow) — N work-units indépendantes détectées
       1. [backend]  projects-backend  → branche build/<plan>/projects-backend
       2. [frontend] backlog-front      → branche build/<plan>/backlog-front
       3. ...
     ```

4. **Create a git branch**
   - Infer the branch type from the plan's content and title:
     - `feat/` — new feature or capability
     - `fix/` — bug fix
     - `chore/` — maintenance, deps, config, tooling
     - `docs/` — documentation only
     - `refactor/` — code restructuring without behavior change
     - `test/` — adding or updating tests
     - `hotfix/` — urgent production fix
   - Derive a short, hyphenated name from the plan title or filename
   - Run `git checkout -b [type]/[name]` (e.g. `feat/user-auth`, `fix/login-redirect`)
   - Confirm the branch was created before proceeding
   - **Mode parallèle** : cette branche est la **branche d'intégration**. Les branches d'unités `build/<plan-slug>/<unit-slug>` seront créées dans leurs worktrees respectifs et mergées ici à l'étape 5b.

5. **Implement**

   ### Mode LINÉAIRE

   #### Priorité `backend` (ou phase backend d'un fullstack)
   - Implémenter directement avec sonnet
   - Suivre les phases du plan pas à pas
   - Créer/modifier les fichiers spécifiés
   - **Commit-as-you-go** : si le plan définit une stratégie de commits, commiter à la fin de chaque sous-phase

   #### Priorité `frontend` (ou phase frontend d'un fullstack)
   - Collecter le contexte nécessaire : lire les fichiers concernés
   - Pour chaque phase ou composant, déléguer à GLM via `mcp__delegate__delegate_to` :
     - `provider_hint: "glm"`
     - `task` : description précise et autonome de ce qui est à implémenter
     - `context` : contenu des fichiers concernés + extrait du plan + conventions Ember du projet (GTS, Octane, Embroider)
   - Appliquer les changements retournés par GLM avec les outils Edit/Write
   - Vérifier que le code retourné compile (TypeScript / Ember build)
   - **Commit-as-you-go** après chaque composant ou phase appliqué

   #### Priorité `fullstack`
   - Phase(s) backend d'abord : exécution directe sonnet → commit
   - Phase(s) frontend ensuite : délégation GLM → appliquer → commit

   ### Mode PARALLÈLE (workflow)

   - Lancer l'outil `Workflow` avec le script ci-dessous, en passant les work-units découpées à l'étape "Mode d'exécution" via `args`.
   - `args` attendu :
     ```json
     {
       "units": [
         { "slug": "projects-backend", "kind": "backend",
           "branch": "build/<plan>/projects-backend",
           "files": ["@libs/projects-backend/src/..."],
           "instructions": "<extrait précis du plan pour cette unité>" }
       ],
       "planExcerpt": "<résumé/extrait pertinent du plan>",
       "conventions": "<conventions clés : JSON:API, Zod 4, store.request, GTS/Octane, etc.>"
     }
     ```
   - Script à lancer (inline) :
     ```js
     export const meta = {
       name: 'tpk-build-parallel',
       description: 'Implémente en parallèle les work-units indépendantes d\'un plan (worktrees isolés) puis vérifie chacune',
       phases: [
         { title: 'Implement', detail: 'un agent par work-unit, worktree isolé' },
         { title: 'Verify', detail: 'vérification adversariale par work-unit' },
       ],
     }

     const IMPL_SCHEMA = {
       type: 'object',
       required: ['slug', 'branch', 'status', 'summary', 'filesTouched'],
       properties: {
         slug: { type: 'string' },
         branch: { type: 'string' },
         status: { enum: ['committed', 'failed'] },
         summary: { type: 'string' },
         filesTouched: { type: 'array', items: { type: 'string' } },
       },
     }
     const VERDICT_SCHEMA = {
       type: 'object',
       required: ['slug', 'compiles', 'matchesPlan', 'issues'],
       properties: {
         slug: { type: 'string' },
         compiles: { type: 'boolean' },
         matchesPlan: { type: 'boolean' },
         issues: { type: 'array', items: { type: 'string' } },
       },
     }

     const results = await pipeline(
       args.units,
       (u) => agent(
         `Tu implémentes la work-unit "${u.slug}" (${u.kind}) d'un plan SprintForge.
          Tu travailles dans un git WORKTREE ISOLÉ : crée et utilise la branche ${u.branch}.
          ${u.kind === 'frontend'
            ? 'IMPLÉMENTATION FRONTEND : délègue le code à GLM via mcp__delegate__delegate_to (provider_hint: "glm"), en lui passant des instructions autonomes + le contenu des fichiers concernés + les conventions Ember (GTS, Octane, Embroider, store.request, schemas WarpDrive). Puis applique le résultat avec Edit/Write et vérifie que ça compile (ember build / tsc).'
            : 'IMPLÉMENTATION BACKEND : implémente directement (Fastify 5, Zod 4, JSON:API via @libs/backend-shared, MikroORM 7). Vérifie que tsc passe.'}
          Fichiers concernés (NE TOUCHE QUE CEUX-LÀ pour éviter les conflits) : ${u.files.join(', ')}
          Conventions projet : ${args.conventions}
          Extrait du plan : ${args.planExcerpt}
          Instructions de l'unité : ${u.instructions}
          Quand c'est terminé : commit tes changements sur ${u.branch} avec un message conventionnel, puis retourne le résumé structuré.`,
         { label: `impl:${u.slug}`, phase: 'Implement', isolation: 'worktree', schema: IMPL_SCHEMA }
       ),
       (impl, u) => agent(
         `Vérifie de façon ADVERSARIALE la work-unit "${u.slug}" implémentée sur la branche ${u.branch}.
          Checkout/inspecte la branche. Vérifie : (1) le code compile (tsc, et ember build si frontend), (2) il respecte l'extrait du plan, (3) il suit les conventions (pas de fetch() brut vers /api/v1, retours API robustes, schemas WarpDrive enregistrés, JSON:API côté back), (4) aucune régression évidente.
          Résumé d'implémentation : ${JSON.stringify(impl)}
          Conventions : ${args.conventions}
          Sois sceptique : signale tout doute dans "issues".`,
         { label: `verify:${u.slug}`, phase: 'Verify', schema: VERDICT_SCHEMA }
       )
     )
     return results.filter(Boolean)
     ```
   - **Suivre la progression** via `/workflows`. Le workflow tourne en arrière-plan ; attendre sa `<task-notification>` de complétion.

5b. **Merge des unités** ← mode parallèle uniquement
   - Pour chaque unité dont le verdict est sain (`compiles: true`, `matchesPlan: true`, pas d'`issues` bloquante), merger sa branche dans la branche d'intégration (étape 4), **dans l'ordre des dépendances** (backend avant frontend si le front en dépend) :
     ```
     git merge --no-ff build/<plan>/<unit-slug>
     ```
   - En cas de conflit : résoudre manuellement (les partitions étant disjointes, les conflits doivent être rares — un conflit signale un mauvais découpage).
   - Pour une unité au verdict ❌ : ne PAS merger, consigner le problème, et soit corriger en linéaire, soit laisser le plan en `todo/` (échec).
   - Nettoyer les branches d'unités mergées : `git branch -d build/<plan>/<unit-slug>`.

6. **Validate**
   - `pnpm turbo lint` from repo root — use turbo, not `pnpm lint` in a single package, to match CI exactly
   - Si le projet a des tests, les lancer : `pnpm turbo test` (ou la commande appropriée)
   - Si frontend : `pnpm turbo build --filter='@libs/<lib>'` pour détecter les erreurs TypeScript
   - **Mode parallèle** : la validation se fait sur la branche d'intégration APRÈS merge (les vérifs par-unité du workflow ne remplacent pas le lint/test global, qui voit les interactions inter-unités).
   - Corriger tous les problèmes avant de continuer

6c. **Lockfile reminder** ← si `package.json` a été modifié
   - Vérifier si `pnpm-lock.yaml` figure dans `git status`
   - Si oui : **Claude ne peut pas stager ce fichier** (hook damage-control bloque `git add pnpm-lock.yaml`)
   - Afficher ce message à l'utilisateur :
     ```
     ⚠️  pnpm-lock.yaml a changé. Claude ne peut pas le committer (hook).
     Lance cette commande toi-même avant le prochain push :
       ! git add pnpm-lock.yaml
     Sans ça, la CI échouera avec ERR_PNPM_OUTDATED_LOCKFILE.
     ```

6b. **Verify success criteria** ← étape obligatoire avant de déplacer vers done/
   - Lire la section "Critères de succès" du plan
   - Pour chaque critère, confirmer son statut (✅ ou ❌) explicitement
   - Si le plan exige des tests d'intégration, les lancer — un smoke test manuel n'est PAS un substitut
   - Si un critère est ❌, corriger avant de continuer
   - Ne jamais sauter cette étape silencieusement

7. **Move plan to done**
   - Seulement quand tous les critères sont ✅
   - On success: `mkdir -p specs/done && mv [PATH_TO_PLAN] specs/done/`
   - On failure: leave in `specs/todo/` for retry

8. **Show changes**
   - Run `git status` to show what changed
   - Ask user if they want to commit

## Report

```
Build Complete

Plan: [original path]
Branch: [type]/[name]
Mode: LINÉAIRE | PARALLÈLE (workflow, N work-units)
Priorité: frontend | backend | fullstack
Agents: GLM (delegate) | Sonnet (direct) | Sonnet + GLM
Status: SUCCESS / FAILED
Location: specs/done/[filename] (moved) OR specs/todo/[filename] (retry needed)

Work-units (mode parallèle) :
- [slug] kind=backend  → merged ✅ / skipped ❌ (raison)
- [slug] kind=frontend → merged ✅

Changes Made:
- [change 1]
- [change 2]
- [change 3]

Files Modified: [count]

Next: Review changes with `git diff` or commit with `/TPK-commit`
```
