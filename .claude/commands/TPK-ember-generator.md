---
description: Génère des éléments frontend EmberJS (lib, composants, routes, services) selon les best practices du projet
allowed-tools: Read, Edit, Write, Bash, Glob, Grep
model: sonnet
argument-hint: [type] [nom] (ex: lib todos, component todo-form, route dashboard/todos)
---

> **Démarrage** : affiche immédiatement `[TPK-ember-generator] 🤖 Modèle : sonnet` comme première ligne de sortie.

# Ember Generator

## Purpose

Génère de manière guidée des éléments frontend EmberJS (librairies complètes, composants, routes, services, formulaires, tables) en respectant strictement :

1. **Le tutoriel canonique du projet** : `tuto/0_frontend.packed.md` (structure de lib, ordre des étapes, conventions)
2. **Les best practices Ember** du skill `ember-best-practices` (performance, accessibilité, patterns Octane/Glimmer)
3. **La hiérarchie de composants UI imposée par le projet** (voir Routing Rules ci-dessous)

## Variables

GENERATOR_TYPE: $1 — type d'élément à générer (`lib`, `component`, `route`, `service`, `form`, `table`, `schema`, `changeset`, `http-mock`)
TARGET_NAME: $2 — nom kebab-case de l'élément (ex: `todos`, `todo-form`, `dashboard/todos`)
EXTRA_ARGS: $ARGUMENTS — arguments additionnels (champs, options, etc.)

## Routing Rules — Hiérarchie des composants UI

À chaque besoin d'un composant UI (input, select, table, modal, button, form…), suivre **strictement** cet ordre :

| Priorité | Source | Quand l'utiliser | Documentation |
|---|---|---|---|
| **1** | `@triptyk/ember-common-ui` | Forms, tables, selects, modals, inputs validés | https://triptyk.github.io/ember-common-ui/ |
| **2** | **DaisyUI** (déjà installé) | Layout, badges, alerts, cards, navigation, tout composant non couvert par Triptyk | https://daisyui.com/components/ |
| **3** | **Proposition utilisateur** | Si rien d'existant ne couvre le besoin → proposer un composant custom Glimmer avec les best practices du projet |

**Composants Triptyk fréquents** :
- `TpkForm` + `TpkInputPrefab`, `TpkTextareaPrefab`, `TpkCheckboxPrefab`, `TpkSelectPrefab` (`@triptyk/ember-input-validation`)
- `TpkTableGenericPrefab` (`@triptyk/ember-ui/components/prefabs/tpk-table-generic-prefab`)
- `TpkConfirmModalPrefab` (`@triptyk/ember-ui/components/prefabs/tpk-confirm-modal-prefab`)
- `TpkButton` (`@triptyk/ember-input/components/prefabs/tpk-prefab-button`)

**Règle absolue** : ne JAMAIS écrire de `<input>`, `<select>`, `<table>` HTML brut quand un prefab Triptyk existe. Si rien n'existe, vérifier DaisyUI (`btn`, `card`, `modal`, `alert`, `badge`…) AVANT de proposer un composant custom.

## Instructions

- Si `GENERATOR_TYPE` ou `TARGET_NAME` est manquant, demander via AskUserQuestion
- Toujours invoquer le skill `ember-best-practices` AVANT de générer le code (lecture des règles à jour)
- Toujours lire `tuto/0_frontend.packed.md` AVANT de générer une lib complète
- Respecter les conventions du projet (`CLAUDE.md`) — notamment :
  - Pas de `fetch()` brut → utiliser `store.request()` ou `authFetch`
  - Schémas WarpDrive enregistrés manuellement dans `@apps/front/app/services/store.ts`
  - Traductions dans `@apps/front/translations/<namespace>/` (PAS dans la lib)
  - Tests : `*-test.gts` (dash, pas dot)
- Imports internes via chemins relatifs (`#src/...` ou `./`), jamais `@libs/ma-lib/...` depuis l'intérieur
- Après création d'un nouveau fichier dans `@libs/*/src/`, prévenir l'utilisateur qu'il faut redémarrer Vite

## Workflow

1. **Parse & valider les arguments**
   - Vérifier `GENERATOR_TYPE` ∈ {`lib`, `component`, `route`, `service`, `form`, `table`, `schema`, `changeset`, `http-mock`}
   - Vérifier `TARGET_NAME` en kebab-case
   - Si invalide ou manquant → AskUserQuestion

2. **Charger le contexte**
   - Invoquer le skill `ember-best-practices` (Skill tool) pour récupérer les règles à jour
   - Lire `tuto/0_frontend.packed.md` (vue d'ensemble + section pertinente)
   - Si `lib` : lire la structure existante d'une lib similaire (ex: `@libs/users-front` ou `@libs/backlog-front`) pour aligner les conventions
   - Pour les composants UI, identifier les composants Triptyk/DaisyUI nécessaires (voir Routing Rules)

3. **Détecter les composants UI à utiliser**
   - Lister les besoins UI (input, select, table, modal…)
   - Pour chaque besoin :
     - Vérifier d'abord dans `@triptyk/ember-common-ui` / `@triptyk/ember-input-validation` / `@triptyk/ember-ui` / `@triptyk/ember-input`
     - Sinon DaisyUI
     - Sinon → proposer à l'utilisateur via AskUserQuestion avec une recommandation argumentée
   - Annoncer la décision avant de générer :
     ```
     Composants UI sélectionnés :
     - Form input → TpkInputPrefab (Triptyk)
     - Status badge → DaisyUI badge badge-primary
     - Custom widget X → proposition utilisateur (rien d'existant)
     ```

4. **Générer le code**

   ### Type `lib`
   - Suivre les 17 étapes de `tuto/0_frontend.packed.md` dans l'ordre
   - Créer la structure complète : `src/`, `tests/`, `package.json`, `tsconfig.json`
   - Générer `index.ts` avec `initialize()`, `moduleRegistry()`, `forRouter()`
   - Générer schemas WarpDrive, changesets, routes, templates, services, http-mocks
   - Générer les tests unit + integration
   - Préparer la liaison avec `@apps/front` (router, store, app.css, package.json, routes/application.ts)

   ### Type `component`
   - Créer `src/components/[name].gts`
   - Glimmer Component avec types stricts
   - Imports : Triptyk → DaisyUI → custom
   - Inclure `data-test-[name]` pour les tests
   - Inclure traductions via `t` helper d'`ember-intl`
   - Suivre les best practices (tracked properties depuis args interdites — voir mémoire projet)

   ### Type `route`
   - Créer `src/routes/[path].gts` (route) + `src/routes/[path]-template.gts` (template)
   - Modèle typé via `Awaited<ReturnType<Route['model']>>`
   - Route avec `model({ id }: { id: string })` si dynamique
   - Template = Glimmer Component séparé du Route

   ### Type `service`
   - Créer `src/services/[name].ts`
   - Service Ember avec méthodes CRUD : `create()`, `update()`, `delete()`, `save()` (dispatch create/update)
   - Utiliser `store.request()` ou `authFetch` — JAMAIS `fetch()` brut
   - Si DELETE sans body → utiliser `authFetch` (Fastify v5 rejette `Content-Type: application/json` sans body)

   ### Type `form`
   - Créer `src/components/forms/[name]-form.gts` + `[name]-validation.ts` + `src/changesets/[name].ts`
   - `TpkForm` + prefabs Triptyk
   - Validation Zod avec messages i18n via `intl.t()`
   - Page object via `ember-cli-page-object` pour les tests
   - `HandleSaveService` pour la soumission (`@libs/shared-front/services/handle-save`)

   ### Type `table`
   - `TpkTableGenericPrefab` avec colonnes typées, actions, tri
   - `TpkConfirmModalPrefab` pour les suppressions
   - Icônes via composants `.gts` dans `src/assets/icons/`

   ### Type `schema`
   - WarpDrive schema avec `withDefaults({ type, fields })`
   - Type TypeScript via `WithLegacy<{ ... }>`
   - **Rappel** : enregistrer manuellement dans `@apps/front/app/services/store.ts` (voir CLAUDE.md)

   ### Type `changeset`
   - `ImmerChangeset<DraftType>` avec interface `Draft[Name]`

   ### Type `http-mock`
   - Handlers MSW pour GET (list + by id), POST, PATCH, PUT, DELETE
   - Format JSON:API (`{ data: { id, type, attributes } }`)
   - Filtrage et tri via `searchParams`

5. **Lier à l'application** (uniquement pour `lib`)
   - `@apps/front/app/routes/application.ts` : import `initialize` + handlers MSW
   - `@apps/front/app/router.ts` : import `forRouter` + appel dans `dashboard`
   - `@apps/front/app/services/store.ts` : ajouter le schema WarpDrive
   - `@apps/front/app/styles/app.css` : ajouter `@source "../../node_modules/@libs/[name];"`
   - `@apps/front/package.json` : ajouter `"@libs/[name]": "workspace:*"` dans `devDependencies`
   - Créer les traductions `@apps/front/translations/[name]/en-us.yaml` + `fr-fr.yaml`

6. **Valider**
   - Lancer `pnpm turbo lint --filter=[lib]` (lint sur la lib créée)
   - Si nouvelle lib → demander à l'utilisateur de commiter `pnpm-lock.yaml` (le hook bloque cet add pour Claude)
   - Demander à l'utilisateur de redémarrer Vite si nouveau fichier ajouté dans une lib existante
   - Vérifier `pnpm build` si modifications front (détecte erreurs TypeScript)

7. **Rapport final**
   - Lister les fichiers créés/modifiés
   - Lister les composants UI utilisés (Triptyk / DaisyUI / custom)
   - Indiquer les étapes manuelles restantes (commit lockfile, restart Vite, traductions…)

## Report

```
Ember Generator — Génération terminée

Type        : [lib | component | route | service | form | table | schema | changeset | http-mock]
Cible       : [TARGET_NAME]
Best practices : ember-best-practices skill v[version]

Composants UI utilisés :
- Triptyk : [liste]
- DaisyUI : [liste]
- Custom  : [liste avec justification]

Fichiers créés :
- [chemin 1]
- [chemin 2]
- ...

Fichiers modifiés (liaison app) :
- [chemin 1]
- ...

Étapes manuelles restantes :
- [ ] Redémarrer le dev server Vite (purge cache imports)
- [ ] Commiter pnpm-lock.yaml (si nouvelle lib)
- [ ] Ajouter traductions dans @apps/front/translations/[name]/
- [ ] Tester via `pnpm dev` sur http://localhost:4200

Validation :
- Lint   : [✅ / ❌]
- Build  : [✅ / ❌ / non lancé]
- Tests  : [✅ / ❌ / non lancés]

Next : Tester via `pnpm dev` ou créer un test d'acceptance avec `/TPK-build`
```
