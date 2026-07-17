# Formulaires Ember — composants ember-common-ui

Les formulaires des libs `*-front` doivent utiliser les composants `@triptyk/ember-input(-validation)` (TpkInput, TpkSelect, TpkDatepicker...) plutôt que des `<input>`/`<select>` bruts. Convention détaillée dans `tuto/0_frontend.md`.

Cette règle a été appliquée rétroactivement à `incident-registry-front` et `access-registry-front` (goal `goal_Acwxq6y`) après un audit ayant identifié des inputs HTML bruts non conformes dans les formulaires de signature, les éditeurs de listes et les filtres de table.

## Titre de page et icône de retour

Chaque formulaire principal affiche un `<h1>` au-dessus du `<TpkForm>` et une icône de retour accolée au lien « retour » à côté du bouton submit.

Convention appliquée à `user-form.gts`, `todo-form.gts`, `role-form.gts` et `access-record-form.gts`. L'icône est `ArrowLeftIcon` (`@libs/shared-front/src/assets/icons/arrow-left.gts`). Le titre bascule entre une clé `titles.create`/`titles.edit` (`t.<domain>.forms.<entity>.titles.*`) via le getter `isCreate` déjà existant (`!changeset.get('id')`) pour les formulaires create+edit ; `access-record-form.gts` n'a pas de mode édition (registre en écriture seule) donc son titre est statique (`access-records.pages.create.title`, clé qui existait déjà mais n'était rendue nulle part). `permissions.forms.role.createTitle`/`editTitle` existaient déjà en traduction sans être branchés — même trou.

`incident-form.gts` (wizard à 8 étapes) est **exclu** de cette convention : il a déjà un `<h2>` de titre par étape et pas de lien « retour à la liste » équivalent près du submit final (seulement une navigation Précédent/Suivant entre étapes) — y ajouter le même pattern nécessiterait une décision de design séparée.

`ArrowLeftIcon` est mutualisée dans `shared-front` (pas dupliquée par lib comme `EditIcon`/`DeleteIcon` dans `users-front`/`todos-front`) car c'est un élément purement cosmétique sans dépendance métier, contrairement aux icônes d'action de tableau qui restent locales à chaque lib par convention établie.

## Champs en ligne avec largeur flexible plutôt qu'un grid 12 colonnes fixe

`user-form.gts` utilise `flex flex-wrap` + `flex-1 min-w-[180px]` par champ plutôt qu'un `grid-cols-12` à spans fixes, pour sa rangée de champs principaux.

Nécessaire car son nombre de champs visibles varie (3 à 5 selon `isCreate`/`canManageRole`) : un span fixe pensé pour 4 champs (`col-span-3` × 4 = 12) débordait sur une seconde ligne dès qu'un 5ᵉ champ (le sélecteur de rôle) apparaissait pour un `tech_admin` en création. Le flex s'adapte au nombre de champs réellement affiché sans recalcul de span. Les autres formulaires (todo, role, access-record) gardent le grid 12 colonnes car leur nombre de champs visibles est fixe.

## Prefabs vs composants standalone

Deux familles de composants selon le contexte : les prefabs `F.Tpk*Prefab` à l'intérieur d'un `TpkForm as |F|` lié à un changeset, et les composants standalone `Tpk*` partout ailleurs.

- **Prefab** (`F.TpkInputPrefab`, `F.TpkSelectPrefab`, `F.TpkDatepickerPrefab`...) : utilisé dans `<TpkForm @changeset={{...}} as |F|>`, câblé via `@validationField` au schéma zod du changeset. C'est le cas de `access-record-form.gts` et des champs principaux d'`incident-form.gts`.
- **Standalone** (`TpkInput`, `TpkSelect`, `TpkTextarea`...) : utilisé hors contexte `TpkForm` — état local type `draft` (éditeurs de listes : `incident-timeline-editor`, `incident-access-logs-editor`, `incident-corrective-actions-editor`) ou filtres de table (`incident-table.gts`). Binding manuel via `@value`/`@onChange`, pas de `@validationField`.

Ne pas mélanger les deux : un composant standalone dans un contexte `TpkForm` perd la validation automatique du changeset.

## Valeur initiale null obligatoire pour TpkDatepickerPrefab

`F.TpkDatepickerPrefab` (dates `accessedAt`, `reportDate`, `incidentStartAt`, `incidentEndAt`, `detectedAt`, `resolvedAt`) exige que le champ du changeset soit initialisé à `null`, jamais laissé `undefined`, sous peine de crash au montage.

`TpkValidationDatepicker` (dans `@triptyk/ember-input-validation`) fait un `assert` sur sa valeur : `string | Date | null` — `undefined` la fait échouer. Un défaut auto-rempli avec une date du jour (`new Date().toISOString()`) casse aussi le composant : la valeur brute est passée telle quelle à tempus-dominus comme `defaultDate`, qui la parse selon `localization.format` (`dd/MM/yyyy` par défaut) — un ISO datetime complet ne matche pas ce format et lève une exception non gérée au rendu. Toujours initialiser ces champs à `null` dans le changeset par défaut (voir `buildDefaultChangeset` dans `incident-registry-front/src/routes/dashboard/incidents/create-template.gts` — non lié en wiki-link, `.gts` non supporté par `lat check`), et laisser l'utilisateur choisir la date via le widget plutôt que de pré-remplir une valeur.

Quand le type zod du champ est un `string` requis (pas de `null` dans son union, ex. `reportDate`), le type du changeset (`DraftIncident`) doit être élargi manuellement pour accepter `null` en plus de `string | undefined` — voir [[@libs/incident-registry-front/src/changesets/incident.ts#DraftIncident]].

## @dateFormat obligatoire pour re-parser une valeur ISO déjà sélectionnée

Même le piège `null` évité, `F.TpkDatepickerPrefab` recrashe dès qu'un utilisateur choisit une date, car `onChange` réécrit une ISO string dans le changeset qui redéclenche une réinitialisation de tempus-dominus.

Le modifier `setupElement` (destroy+setup) réinitialise tempus-dominus avec cette même string comme `defaultDate`, reparsée selon `localization.format` — `dd/MM/yyyy` par défaut si `@dateFormat` n'est pas fourni. Le premier fix (valeur initiale `null`) ne couvre que le montage initial, pas ce cycle de re-sélection.

Fix : passer explicitement `@dateFormat="yyyy-MM-dd[T]HH:mm:ss[Z]"` sur chaque `F.TpkDatepickerPrefab` lié à un champ ISO. Le tokenizer de parsing de tempus-dominus (`formattingTokens` dans `datetime.ts`) ne reconnaît ni token millisecondes (`fff`) ni timezone — sans conséquence ici car ses recherches de motifs (`\d\d`, etc.) ne sont pas ancrées en début de chaîne, donc les caractères `.000` et `Z` restants sont simplement ignorés plutôt que de casser le parsing. `T`/`t` sont des tokens réservés (méridien AM/PM) : toujours les échapper en `[T]` dans un format personnalisé, sous peine d'interprétation erronée.

Champs concernés : `accessedAt` (`access-record-form.gts`), `reportDate`/`incidentStartAt`/`incidentEndAt`/`detectedAt`/`resolvedAt` (`incident-form.gts`). Ce fix élimine le crash mais pas l'avertissement `TD: Using a string for date options...` — voir section suivante pour l'éliminer complètement.

## Stocker un Date, pas une string, pendant l'édition

Tempus-dominus loggue `console.warn("TD: Using a string for date options...")` dès qu'une **string** est passée pour `defaultDate`, quel que soit son format.

`@dateFormat` n'a aucune influence sur cet avertissement (voir `convertToDateTime` dans `typeChecker.ts`) — seul le *type* de la valeur compte.

Élimination complète : les handlers `setAccessedAt`/`setDateField` stockent l'objet `Date` brut dans le changeset (`changeset.set('accessedAt', dates[0] ?? null)`), jamais `.toISOString()`. `TpkValidationDatepicker` accepte `Date` nativement (`assert` : `string | Date | null`) et `tryConvertToDateTime` bypasse alors tout le parsing par string (`d.constructor.name === Date.name` → conversion directe, aucun appel à `DateTime.fromString`, donc aucun avertissement).

Piège : `TpkForm` type `@changeset` en fonction du schéma de validation (`ChangesetFormComponentArgs<S, T extends ImmerChangeset<DeepNullable<PartialDeep<z.infer<S>>>>>` — voir `tpk-form.d.ts`), donc le changeset **doit** structurellement déclarer ces champs en `string | null` (pas `Date | null`) sous peine d'erreur de type à la compilation. Solution : garder le type `string | null` dans `DraftAccessRecord`/`DraftIncident`, mais stocker un `Date` réel au runtime via un cast (`as unknown as string | null`) au point d'appel de `.set(...)` — voir [[@libs/access-registry-front/src/changesets/access-record.ts#DraftAccessRecord]] et [[@libs/incident-registry-front/src/changesets/incident.ts#DraftIncident]]. `setDateField` (incident-form) n'a pas besoin du cast car sa clé (`field: string`, pas un littéral `keyof`) élargit déjà le type accepté par `.set()`.

La conversion Date → ISO se fait uniquement dans la validation zod, via `z.preprocess((v) => v instanceof Date ? v.toISOString() : v, schema)` — voir `dateInputToIso` dans `access-record-validation.ts` et `incident-validation.ts`. Le payload validé/soumis reste une vraie string ISO, le contrat backend est inchangé.

Vérifié en navigateur réel (sélection initiale + re-sélection + réouverture avec valeur déjà posée) : zéro erreur **et zéro avertissement** console.
