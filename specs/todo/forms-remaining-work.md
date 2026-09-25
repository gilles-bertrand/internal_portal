# Plan — Suite conformité formulaires (ember-common-ui) + RGPD access-record

**Contexte :** consolide et remplace `forms-ember-common-ui-compliance.md` et
`access-record-form-selects-rgpd-datepicker.md` (T0–T3f, T1–T3 déjà faits — voir
« Déjà fait » ci-dessous). Ce plan ne couvre que le travail **restant**.

**Branche :** `fix/forms-ember-common-ui-T1f-T4f` (travail additif, pas de nouveau worktree).

**Gate non négociable :** aucun commit sans validation humaine préalable.

---

## Déjà fait (ne pas refaire)

- `@apps/front/app/styles/app.css` : `@import './icons.css';` (icône calendrier + chevron select).
- `incident-registry-front` : éditeurs de listes (T2) et filtres de table (T3) déjà
  mergés (commits `b44e91b`, `1426976`). Signatures de `incident-form.gts` converties
  en `TpkInput` standalone (déviation documentée — pas de prefab possible car
  `issuerSignature`/`recipientSignature` sont des objets imbriqués hors schéma zod
  top-level).
- **TA** — `incident-form.gts` : `reportDate`, `incidentStartAt`, `incidentEndAt`,
  `detectedAt`, `resolvedAt` en `F.TpkDatepickerPrefab`. Bug corrigé au passage :
  pré-remplissage par défaut (`new Date().toISOString()`) faisait planter le
  datepicker (tempus-dominus parse la valeur initiale selon son format d'affichage
  `dd/MM/yyyy`, incompatible avec un ISO datetime) — les champs sont maintenant
  initialisés à `null`. Documenté dans [[frontend/forms#Valeur initiale null obligatoire pour TpkDatepickerPrefab]].
- **TB (élargi)** — `access-record-form.gts` : `purpose`, `legalBasis`, `dataCategories`
  branchés sur les référentiels backend dynamiques (`/purposes`, `/legal-bases`,
  `/data-categories`), fetchés par `AccessRecordsCreateRoute#model` et passés en
  `@args` au formulaire. Remplace l'implémentation précédente (T2f/T3f) qui codait
  `legalBasis`/`dataCategories` en slugs statiques + i18n alors que le référentiel
  existait déjà côté code (entités backend, schémas warp-drive, mocks MSW) mais
  n'était pas branché. `accessType` reste seul en enum statique (pas de référentiel
  backend pour ce champ). Validation `legalBasis`/`dataCategories`/`purpose` relâchée
  à `string().min(1)` (l'ensemble des codes valides n'est connu qu'au runtime).
  Documenté dans [[frontend/access-record-options]].

## Ce qui reste

### TC — Tests & QA
- ✅ `pnpm --filter @libs/access-registry-front test` (34/34) et
  `pnpm --filter @libs/incident-registry-front test` (12/12) verts.
- ✅ Lint (JS/types/format/hbs) des deux libs + `@apps/front` verts.
- ✅ Vérification manuelle navigateur (`/access-records/create`, mode mocké MSW) :
  icône calendrier + chevrons visibles, `purpose`/`legalBasis`/`dataCategories`
  alimentés par les vraies données référentielles mockées, aucune erreur console.
  **Bug réel trouvé et corrigé au passage** : les schémas warp-drive
  `PurposeSchema`/`LegalBasisSchema`/`DataCategorySchema` n'étaient jamais
  enregistrés dans `@apps/front/app/services/store.ts` → `Missing Resource Type`
  au premier fetch, invisible en tests de composant (args directs, pas de store).
  Documenté dans [[frontend/access-record-options#Enregistrement obligatoire des schémas warp-drive]].
- ⬜ Vérification manuelle navigateur des datepickers `incident-form` (TA) —
  **bloquée** : `incident-registry-front` n'est pas monté dans le routeur de
  l'app (`@apps/front/app/router.ts` n'importe/mount que `users-front`,
  `todos-front`, `access-registry-front` — pas `incident-registry-front`).
  `/incidents/create` renvoie `UnrecognizedURLError`. Pré-existant, pas introduit
  par ce goal. TA reste validé par les tests vitest (12/12 verts) uniquement.
  À signaler séparément : la fonctionnalité incidents est actuellement
  inaccessible dans l'app malgré un code complet (routes, formulaire, tests).
- ⬜ Build complet du monorepo (`pnpm build` ou équivalent turbo) — pas encore relancé.

### TD — Doc `lat.md`
- ✅ [[frontend/forms]] et [[frontend/access-record-options]] à jour, `lat check` vert.
- ✅ Enseignement de la vérif navigateur (schémas warp-drive non enregistrés) documenté.

## Hors scope
- Boutons `<button type=submit>` (convention acceptée).
- Refonte du contrat backend `dataCategories` au-delà du strict nécessaire.
- Montée de version de `@triptyk/ember-input` pour corriger le bug `@multiple`
  (contournement en place, documenté dans [[frontend/access-record-options]]).
- Ajout d'un fallback texte libre pour `purpose` si le référentiel est vide/en
  erreur (non demandé, à évaluer séparément si besoin réel identifié).
