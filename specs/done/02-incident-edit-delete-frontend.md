# Registre d'incidents — édition, suppression (soft) & restauration (Frontend)

## Contexte & décisions actées

Front de la feature « éditer / supprimer un incident » (voir le backend dans [[specs/done/01-incident-edit-delete-backend.md]] ou `specs/todo/01-...` s'il n'est pas encore mergé). Décisions :

- **Édition** : réutiliser le **wizard de création** (`incident-form`) pré-rempli, mais en mode « édition » → au submit, appelle `PUT /incidents/:id` (le backend crée une nouvelle version). Route `incidents/edit` (`/:id/edit`).
- **Suppression** : action **soft-delete** avec **modale de confirmation** (message « l'incident sera masqué, restaurable par le DPO »). Appelle `DELETE /incidents/:id`.
- **Restauration + affichage des supprimés** : **DPO uniquement** (toggle « afficher les supprimés » + action « restaurer »).
- **Permissions front** : actions gardées par l'`AbilityService` (`can('update','Incident')`, `can('delete','Incident')`, `can('restore','Incident')`). L'encoder ne voit les actions édition/suppression que sur les incidents qu'il peut gérer (les siens).

> Dépend du contrat backend de 01 (`PUT /incidents/:id`, `DELETE`, `POST /:id/restore`, `filter[includeDeleted]`, champs lifecycle sérialisés). Les tests front s'appuient sur les mocks MSW.

## Architectural Context

- **Communauté** : `incident-registry-front` ; réutilise `@triptyk/ember-ui` (`TableGenericPrefab`, `TpkConfirmModalPrefab`), `@libs/shared-front` (`AbilityService`, `requireAbilityOrRedirect`).
- **Patterns de référence** :
  - Actions table + modale : [[@libs/users-front/src/components/user-table.gts]] (`actionMenu`, `TpkConfirmModalPrefab`).
  - Route show lecture seule : `incidents/show.gts` (déjà en place).
  - Réutilisation d'un wizard pour édition : le `incident-form` (8 étapes) doit accepter un incident existant + un mode.
- **Contrats** : schéma WarpDrive `Incident` ([[@libs/incident-registry-front/src/schemas/incidents.ts]]) — ajout des champs lifecycle ; service [[@libs/incident-registry-front/src/services/incident.ts]] — méthodes update/delete/restore.

## Phase 1 — Schéma & service

- **Schéma** `incidents.ts` : ajouter les attributs lifecycle `revision`, `supersededById`, `updatedBy`, `updatedAt`, `deletedAt`, `deletedBy` (+ types optionnels/nullable).
- **Service** `incident.ts` : ajouter
  - `update(id, data: ValidatedIncident)` → `PUT /incidents/:id` (JSON:API, corps identique à `create`).
  - `softDelete(id)` → `DELETE /incidents/:id`.
  - `restore(id)` → `POST /incidents/:id/restore`.
  (S'appuyer sur `store.request` + `@warp-drive/utilities/json-api`, comme `create`.)

## Phase 2 — Route & formulaire d'édition

- **Route** `routes/dashboard/incidents/edit.gts` (`/:incident_id/edit`) : `beforeModel` guard `requireAbilityOrRedirect('update','Incident')` ; `model` charge l'incident via `findRecord`.
- **Déclaration** dans [[@libs/incident-registry-front/src/index.ts]] : `this.route('edit', { path: '/:incident_id/edit' })` sous `incidents`.
- **Réutiliser le wizard** : `incident-form.gts` accepte un `@mode` (`'create' | 'edit'`) et un changeset **pré-rempli** depuis l'incident chargé (mapper l'`Incident` → `DraftIncident`, en reconvertissant les dates ISO→Date comme à l'édition — cf. note `@lat frontend/forms#Stocker un Date`). En mode édition, `onSubmit` appelle `incident.update(id, data)` au lieu de `incident.create`. Réutiliser `handleSave` (succès → transition vers la liste).
- **`edit-template.gts`** : instancie le changeset pré-rempli et rend `<IncidentForm @mode="edit" ... />`.

## Phase 3 — Actions de table + modale + filtre supprimés

Dans [[@libs/incident-registry-front/src/components/incident-table.gts]] :
- Ajouter un `actionMenu` (pattern user-table), **gardé par ability** :
  - « Voir » (existe déjà via `rowClick` → show).
  - « Éditer » (icône crayon) → `dashboard.incidents.edit` — visible si `can('update','Incident')`.
  - « Supprimer » (icône poubelle) → ouvre `TpkConfirmModalPrefab` (message « ceci masquera l'incident ; restaurable par le DPO ») → `incident.softDelete(id)` puis refresh — visible si `can('delete','Incident')`.
  - « Restaurer » → visible **seulement** sur les lignes supprimées et si `can('restore','Incident')` (dpo) → `incident.restore(id)`.
- **Filtre « afficher les supprimés »** : toggle visible si `can('restore','Incident')` (dpo). Quand actif, la table charge avec `filter[includeDeleted]=true` (via `additionalFilters` de `TableParams`). Les lignes supprimées sont **taguées** (badge « supprimé »).
- Après delete/restore, rafraîchir la table (via `registerApi`/refetch du prefab, ou transition/rechargement de route).

## Phase 4 — i18n + gating

- Ajouter les clés i18n (fr + en) : `incidents.table.actions.{edit,delete,restore}`, `incidents.table.confirmDelete.{question,confirm,cancel}`, `incidents.table.showDeleted`, `incidents.table.deletedBadge`, `incidents.pages.edit.title`, messages succès/erreur delete/restore/update.
- Icônes : réutiliser/create `edit`/`delete` (mirror `@libs/users-front/src/assets/icons`), + une icône « restaurer ».

## Stratégie de test (bloquant avant `done/`)

Tests front (`renderingTest`/`applicationTest`, MSW), style existant :
1. **Table** : les actions « éditer »/« supprimer » n'apparaissent que si l'ability le permet (mock ability update/delete) ; « restaurer » et le toggle « afficher supprimés » n'apparaissent que pour `restore` (dpo).
2. **Suppression** : clic « supprimer » → modale ; confirmer appelle `incident.softDelete` (mock) et retire la ligne.
3. **Édition** : la route edit pré-remplit le formulaire depuis l'incident (mock `GET /incidents/:id`) ; submit appelle `incident.update` (mock) avec les données.
4. **Guard** : `/incidents/:id/edit` sans `update:Incident` → redirection + flash (acceptance, comme les guards existants).
5. Mock MSW : `PUT /api/v1/incidents/:id`, `DELETE /api/v1/incidents/:id`, `POST /api/v1/incidents/:id/restore`, et `GET /api/v1/incidents?...filter[includeDeleted]`.

## Critères de succès (vérifiables)

1. Une action **« éditer »** ouvre le wizard pré-rempli ; le submit appelle `PUT /incidents/:id` (nouvelle version côté back).
2. Une action **« supprimer »** ouvre une **modale de confirmation** avec message d'avertissement, puis soft-supprime (l'incident disparaît de la liste).
3. Les actions sont **gardées par l'ability** : un encoder ne voit édition/suppression que sur ses incidents ; « restaurer » + « afficher supprimés » **seulement** pour le DPO.
4. Le DPO peut activer « afficher les supprimés » (liste `includeDeleted`), voit les incidents supprimés **taggés**, et peut les **restaurer**.
5. La route `incidents/edit` est gardée `update:Incident` (redirection sinon).
6. `pnpm lint`/`lint:types`/build glint OK sur `@libs/incident-registry-front` (+ `@apps/front` pour i18n/store si besoin).
7. Tous les tests front (existants + nouveaux) passent.
8. `lat.md` (frontend incident) à jour + `lat check` OK.

## Risques / à confirmer au build

- **Réutilisation du wizard 8 étapes pour l'édition** : c'est le point le plus délicat (mapping `Incident`→`DraftIncident`, dates, listes imbriquées descriptionSections/timeline/correctiveActions/accessLogs, signatures). Vérifier chaque éditeur imbriqué en mode édition.
- Rafraîchissement de la table après delete/restore selon l'API réelle de `TableGenericPrefab` (`registerApi`).
- Le contrat backend (spec 01) doit être mergé ou mocké fidèlement.
- Gating fin des actions par ligne (encoder ne doit pas voir « supprimer » sur l'incident d'un autre) : si l'ability front n'a pas la condition `encodedBy`, se rabattre sur un check `incident.encodedBy === currentUser.id || can('restore','Incident')`.
