# Registre d'accès — colonnes de liste, icône « données sensibles », détail lecture seule

## Contexte & décisions actées

Améliorer la **liste** des access-records (`@libs/access-registry-front/src/components/access-record-table.gts`) et ajouter une **vue détail en lecture seule**. Décisions prises avec l'utilisateur (via clarification) :

- **Icône « données sensibles »** : bouclier + « ! » (heroicons `shield-exclamation`), couleur **warning/amber**, affichée uniquement quand `isSpecialCategory = true`.
- **« Voir les détails »** : route `show` **en lecture seule**. Pas d'édition — le registre est inaltérable par conception (voir contrainte ci-dessous).
- **« Supprimer »** : **abandonné**. Aucune action de suppression, aucune modale. Le registre est append-only ; la suppression est physiquement bloquée en base.
- **Formulaire** : le champ `justification` doit occuper toute la largeur (2 colonnes) — **déjà `col-span-12`** dans le code actuel ; simple vérification (a priori no-op).

### Contrainte d'architecture (raison de l'abandon édition/suppression)

`access_record` est une table **append-only à chaîne de hash** (`seq`/`prevHash`/`hash`). Des **triggers Postgres `forbid_mutation()`** bloquent physiquement tout `UPDATE`/`DELETE` ([[backend/hash-chain-integrity#Défense en profondeur : triggers Postgres append-only]]). Toute route d'édition/suppression planterait en base et casserait la garantie RGPD tamper-evident. → **Aucune route backend n'est créée pour ce plan.**

## Périmètre : frontend uniquement (`@libs/access-registry-front`)

Le backend `GET /access-records/:id` existe déjà ([[@libs/access-registry-backend/src/routes/get.route.ts#GetRoute]]) avec vérification row-level (un encoder ne voit que ses propres enregistrements via `subject()`). **Aucun changement backend requis.**

## Architectural Context

- **Communauté touchée** : `access-registry-front` (composant table, nouvelle route show, détail, icônes, i18n).
- **Contrats réutilisés (inchangés)** :
  - `TableGenericPrefab` / `TableParams` (`@triptyk/ember-ui`) — colonnes, `component` (cellule custom via `@columnsComponent`), `actionMenu`, `rowClick`.
  - Pattern cellule custom **déjà en place** dans [[@libs/access-registry-front/src/components/audit-event-table.gts]] (`OccurredAtCell` + `@columnsComponent={{hash occurredAt=(component ...)}}`).
  - Pattern route `show` **déjà en place** côté incidents : `@libs/incident-registry-front/src/routes/dashboard/incidents/show.gts` + `show-template.gts` + `incident-detail.gts`.
  - `requireAbilityOrRedirect` (`@libs/shared-front`) pour le guard de la route show.
- **Champs déjà disponibles** : le schéma front `AccessRecord` ([[@libs/access-registry-front/src/schemas/access-records.ts]]) contient déjà `accessorRef`, `sourceSystem`, `isSpecialCategory`, etc. — rien à ajouter au schéma.

> Advisory : reconfirmer chaque emplacement par lecture réelle avant édition.

---

## Phase 1 — Colonnes de liste + icône « données sensibles »

### 1a. Colonnes

Dans [[@libs/access-registry-front/src/components/access-record-table.gts]], remplacer les colonnes actuelles par (ordre demandé) :

| field | header (i18n) | sortable | note |
|---|---|---|---|
| `accessedAt` | `table.headers.accessedAt` (Access Date) | oui | inchangé |
| `dataSubjectRef` | `table.headers.dataSubjectRef` (Data subject) | non | inchangé |
| `accessType` | `table.headers.accessType` (Access Type) | non | inchangé |
| `purpose` | `table.headers.purpose` (Purpose) | non | code du référentiel (affiché tel quel, cf. note ci-dessous) |
| `accessorRef` | `table.headers.accessorRef` (**Accessor reference**) | non | **nouveau** ; stocke le nom (snapshot), s'affiche directement |
| `sourceSystem` | `table.headers.sourceSystem` (**Source system**) | non | **nouveau** ; stocke le **code** (cf. note affichage) |
| `isSpecialCategory` | `table.headers.isSpecialCategory` (ou header court « Sensible ») | non | **cellule custom icône** (voir 1b) |

- Ajouter les clés i18n `access-records.table.headers.accessorRef` et `.sourceSystem` (fr + en) dans `@apps/front/translations/access-records/`.

**Note affichage `sourceSystem`/`purpose`/`accessType`** : ces champs stockent un `code`/valeur, pas le libellé. Le comportement actuel (purpose/accessType) affiche déjà la valeur brute — on reste cohérent en affichant `sourceSystem` brut. *(Option d'amélioration hors scope : cellule custom résolvant le label via un fetch `/source-systems` — non retenue pour garder le périmètre serré ; à décider si l'UX l'exige.)*

### 1b. Cellule custom icône « données sensibles »

Créer une icône + une cellule, sur le modèle exact de `OccurredAtCell` dans `audit-event-table.gts` :

1. **Icône** `@libs/access-registry-front/src/assets/icons/special-category.gts` — SVG inline heroicons `shield-exclamation` (mirror du style de `@libs/users-front/src/assets/icons/edit.gts`), classe par défaut `size-4`.
2. **Cellule** `SpecialCategoryCell` (dans `access-record-table.gts`, comme `OccurredAtCell`) :
   ```ts
   class SpecialCategoryCell extends Component<{ Args: { row: AccessRecord } }> {
     get isSensitive() { return this.args.row.isSpecialCategory === true; }
     <template>
       {{#if this.isSensitive}}
         <SpecialCategoryIcon
           class="size-4 text-warning"
           aria-label={{t "access-records.table.sensitiveAria"}}
         />
       {{/if}}
     </template>
   }
   ```
3. Colonne : `{ field: 'isSpecialCategory', headerName: ..., sortable: false, component: 'isSpecialCategory' }` + `@columnsComponent={{hash isSpecialCategory=(component SpecialCategoryCell)}}` sur `<TableGenericPrefab>`.
4. Ajouter la clé i18n `access-records.table.sensitiveAria` (accessibilité).

### 1c. Action « Voir les détails » (pas de suppression)

Ajouter un `actionMenu` à `tableParams` (pattern [[@libs/users-front/src/components/user-table.gts]], mais **une seule action**) :

```ts
actionMenu: [
  {
    icon: <template><EyeIcon class="size-4" /></template> as TOC<{ Element: SVGSVGElement }>,
    action: (element: unknown) =>
      this.router.transitionTo('dashboard.access-records.show', (element as { id: string }).id),
    name: this.intl.t('access-records.table.actions.viewDetails'),
  },
],
```

- Optionnel : `rowClick` vers la même route show (cohérent avec user-table).
- Créer l'icône `@libs/access-registry-front/src/assets/icons/eye.gts` (heroicons `eye`).
- Ajouter la clé i18n `access-records.table.actions.viewDetails`.
- **Ne pas** ajouter `TpkConfirmModalPrefab` ni action delete (décision : aucune suppression).

---

## Phase 2 — Route détail en lecture seule (`show`)

Reproduire le pattern incidents (`@libs/incident-registry-front/.../incidents/show.gts` + `show-template.gts` + `incident-detail.gts`), adapté aux access-records.

### 2a. Déclaration de route

Dans [[@libs/access-registry-front/src/index.ts]], sous `access-records`, ajouter `this.route('show', { path: '/:id' });`.

### 2b. Route `routes/dashboard/access-records/show.gts`

- `beforeModel` : `requireAbilityOrRedirect('read', 'AccessRecord', {...})` (même DI que `create.gts`).
- `model({ id })` : `store.request(findRecord<AccessRecord>('access-records', id))` — gère 404/403 (le backend applique déjà la règle row-level ; un encoder consultant un record d'autrui obtient 403/404).
- Signature `AccessRecordsShowRouteSignature` exportée (comme create).

### 2c. Template `show-template.gts` + composant détail

- `show-template.gts` rend un `<AccessRecordDetail @record={{@model}} />`.
- `components/access-record-detail.gts` *(nouveau)* : affiche **tous** les champs en lecture seule (definition list / grille daisyUI), réutilisant les libellés i18n existants `access-records.forms.accessRecord.labels.*`. Champs : accessedAt (formaté locale), accessorRef, dataSubjectRef, dataCategories, accessType, purpose, legalBasis, sourceSystem, recipient, isSpecialCategory (badge/icône), justification, encodedByName (si présent), encodedAt, retentionUntil, seq/hash (métadonnées d'intégrité, section repliée optionnelle).
- Un lien « retour au registre » (`LinkTo dashboard.access-records`, icône `ArrowLeftIcon` de shared-front, comme le formulaire).
- Ajouter `access-records.pages.show.title` (fr + en).

**Affichage des dates** : réutiliser le formatage locale (`toLocaleString(intl.primaryLocale, ...)`) comme `OccurredAtCell`.

---

## Phase 3 — Formulaire : justification pleine largeur

Vérifier dans [[@libs/access-registry-front/src/components/forms/access-record-form.gts]] que le `F.TpkTextareaPrefab` de `justification` porte bien `class="col-span-12"` (pleine largeur = 2 colonnes de la grille `grid-cols-12`).

- **État attendu** : déjà `col-span-12` → **no-op**, simple confirmation.
- Si (contre toute attente) ce n'est pas le cas, le passer en `col-span-12`.

---

## Stratégie de test (bloquant avant `done/`)

Tests front (`@libs/access-registry-front`), style existant (`renderingTest` + page-object + http-mocks MSW) :

1. **Table** (`tests/integration/access-record-table-test.gts`, étendre l'existant) :
   - Les 6 colonnes attendues sont rendues (accessedAt, dataSubjectRef, accessType, purpose, **accessorRef**, **sourceSystem**).
   - La cellule `isSpecialCategory` **affiche l'icône** quand `true`, **rien** quand `false` (deux fixtures).
   - L'`actionMenu` contient l'action « voir les détails » et navigue vers `dashboard.access-records.show` ; **aucune action de suppression** présente.
2. **Route show** (`tests/acceptance/access-records-test.gts`, étendre) :
   - Naviguer vers `/dashboard/access-records/:id` rend le détail en lecture seule avec les champs clés ; http-mock `GET /api/v1/access-records/:id`.
   - Aucun champ éditable (pas de `<form>`/inputs de saisie).
3. **Icône** : test unitaire/integration que `SpecialCategoryCell` rend l'icône ssi `isSpecialCategory`.

## Critères de succès (vérifiables)

1. La liste affiche les colonnes, dans l'ordre : Access Date, Data subject, Access Type, Purpose, **Accessor reference**, **Source system**.
2. Une **icône bouclier-alerte (amber)** apparaît sur les lignes `isSpecialCategory = true`, et rien sinon ; elle porte un `aria-label`.
3. Un menu d'action par ligne propose **« Voir les détails »** qui ouvre la route `show` ; **aucune** action de suppression n'existe.
4. La route `dashboard.access-records.show` (`/:id`) affiche le détail **en lecture seule** (aucun champ éditable), avec guard `read AccessRecord` et gestion 403/404.
5. Le champ `justification` du formulaire occupe la pleine largeur (`col-span-12`).
6. **Aucune** route/permission d'édition ou de suppression n'est ajoutée ; les triggers append-only et la chaîne de hash restent intacts.
7. `pnpm lint` + `lint:types` OK sur `@libs/access-registry-front` (+ `@apps/front` pour les traductions).
8. Tous les tests front (existants + nouveaux) passent.
9. `lat.md/` mis à jour (section liste/détail access-registry front) et `lat check` OK.

## Risques & points à confirmer au build

- **Résolution du label `sourceSystem`** dans la liste (code vs libellé) : par défaut on affiche le code (cohérent avec purpose/accessType) ; basculer sur une cellule résolvant le libellé seulement si l'UX l'exige.
- **Header de la colonne icône** : header court (« Sensible ») ou icône-only — trancher au build (accessibilité : garder un intitulé lisible par lecteur d'écran).
- **`findRecord` vs `query`** pour la route show : suivre le pattern exact de `incidents/show.gts` (import depuis `@warp-drive/utilities/json-api`).
- **Enregistrement de la route** : vérifier que `forRouter` dans `index.ts` est le bon point (et pas une config de router centrale).
