# Options RGPD — access-record-form

Les champs à choix fermé du formulaire `access-record-form` sont soit un enum statique frontend, soit un select alimenté par un référentiel backend, selon qu'une table de référence existe pour ce champ.

Champs concernés : `accessType` (enum statique), `purpose`, `legalBasis`, `dataCategories`, `sourceSystem` (référentiels dynamiques), `accessorRef` (select d'utilisateurs habilités).

## Référentiels dynamiques vs enum statique

`purpose`, `legalBasis` et `dataCategories` sont alimentés par des référentiels backend ; `accessType` reste un enum statique faute de référentiel équivalent.

Référentiels backend : `/purposes`, `/legal-bases`, `/data-categories` (entités `PurposeEntity`, `LegalBasisEntity`, `DataCategoryEntity` dans `@libs/access-registry-backend/src/entities/`), chargés une seule fois par `AccessRecordsCreateRoute#model` et transmis en `@args` au formulaire. `accessType` utilise `ACCESS_TYPES` dans [[@libs/access-registry-front/src/utils/access-record-options.ts#ACCESS_TYPES]] car aucun référentiel backend n'existe pour ce champ.

Ce découpage a remplacé une première implémentation (T2f/T3f) qui codait `legalBasis`/`dataCategories` en slugs statiques côté frontend avec libellés traduits par i18n — alors qu'un référentiel backend+frontend complet (entités, routes, schémas warp-drive, mocks MSW) existait déjà mais n'était simplement pas branché. Toujours vérifier qu'un référentiel n'existe pas avant d'ajouter un nouvel enum statique pour un champ à choix fermé de ce formulaire.

Pour les champs référentiels, le formulaire construit des options `{value: code, label}` directement depuis les enregistrements reçus en argument (`this.args.purposes`, `.legalBases`, `.dataCategories`) — pas de clé i18n `options.<champ>.<code>`, le libellé vient tel quel du backend. Le `selectedItemComponent` (trigger affiché) résout le libellé du code stocké en le recherchant dans la liste d'options courante, via une fabrique `selectedOptionComponent(getOptions)` plutôt qu'une classe fixe par champ, pour rester générique aux trois champs.

Le même piège existait sur le sélecteur de rôle du formulaire utilisateur (`user-form.gts`, `@libs/users-front`) : sans `@selectedItemComponent`, `TpkValidationSelectPrefab` affiche `String(@selected)` — donc l'UUID du rôle stocké dans le changeset, pas son nom — dès qu'un rôle est déjà sélectionné (édition, ou juste après un choix en création). Corrigé en dupliquant localement le même pattern `selectedOptionComponent(getOptions)`/`idOf` (pas de factorisation vers `shared-front`, chaque lib front reste indépendante). Toujours ajouter `@selectedItemComponent` à un `F.TpkSelectPrefab` dont la valeur stockée est un id/code distinct du libellé affiché.

`accessType` reste seul en Approche A (valeur stockée = libellé affiché, mots français stables dans les deux locales, `string[]` brut) — même pattern que dans `incident-form.gts` (`@libs/incident-registry-front/src/components/forms/incident-form.gts`, non lié en wiki-link : `.gts` non supporté par `lat check`).

## accessorRef — select des utilisateurs habilités (défaut = user courant)

`accessorRef` n'est plus un texte libre mais une select alimentée par `/eligible-accessors` (utilisateurs habilités `create AccessRecord`), pré-remplie par défaut avec le nom de l'utilisateur courant.

Décision produit : on stocke le **nom affiché** (« Prénom Nom »), pas l'id — snapshot cohérent avec un journal append-only, sans changement du contrat backend (`accessorRef` reste `string().min(1)`). C'est donc l'Approche A (valeur = libellé, `string[]` brut), comme `accessType`. Le défaut est posé dans `create-template.gts` (non lié en wiki-link : `.gts` non supporté par `lat check`) via le service `currentUser` (`@libs/users-front`) à la construction du changeset ; la select reste **modifiable** car l'accédant n'est pas toujours l'encodeur. Endpoint documenté côté backend : [[access-registry#Liste des accédants habilités (accessorRef)]].

## sourceSystem — référentiel creatable

`sourceSystem` est un référentiel backend (`{value: code, label}`, comme purpose/legalBasis) mais **creatable** : le formulaire propose les systèmes existants ET une affordance « + Ajouter » pour en créer un nouveau, persisté et partagé.

Faute d'addon `ember-power-select-with-create` dans le projet, la création n'est pas native au select : une affordance custom (input + bouton) appelle [[@libs/access-registry-front/src/services/source-system.ts#SourceSystemService]]`#create`, ajoute le référentiel retourné aux options `@tracked addedSourceSystems` (fusionnées aux `@sourceSystems` chargés), puis sélectionne automatiquement le nouveau code dans le changeset. Le changeset stocke le **code** (pas le label), comme les autres référentiels. Référentiel backend documenté : [[access-registry#Référentiel source-systems (creatable)]].

## Liste : colonnes, icône « données sensibles », détail lecture seule

La liste affiche `accessedAt`, `dataSubjectRef`, `accessType`, `purpose`, `accessorRef`, `sourceSystem` + une icône données sensibles ; chaque ligne ouvre une vue détail **en lecture seule** — ni édition ni suppression (registre inaltérable).

`access-record-table.gts` utilise `TableGenericPrefab` (`@triptyk/ember-ui`). La colonne `isSpecialCategory` est rendue par une **cellule custom** `SpecialCategoryCell` (icône `shield-exclamation` amber affichée ssi `isSpecialCategory`), câblée via `component: 'isSpecialCategory'` + `@columnsComponent={{hash isSpecialCategory=(component SpecialCategoryCell)}}` — même mécanisme que `OccurredAtCell` dans `audit-event-table.gts`. Le menu d'action ne contient qu'une entrée **« voir les détails »** (icône `eye`) + `rowClick`, tous deux vers `dashboard.access-records.show`. `sourceSystem` s'affiche par son **code** (cohérent avec `purpose`/`accessType`), pas son libellé.

La route `show` (`/:access_record_id`, fichier `routes/dashboard/access-records/show.gts` — `.gts` non lié en wiki-link) garde `read AccessRecord` et charge via `findRecord` (le backend applique la règle row-level : 403/404 pour un record d'autrui). Le composant `access-record-detail.gts` affiche tous les champs en lecture seule (aucun input) : **pas d'édition ni de suppression**, car `access_record` est append-only et toute mutation est bloquée par les triggers Postgres ([[backend/hash-chain-integrity#Défense en profondeur : triggers Postgres append-only]]). Aucune route backend ajoutée (`GET /access-records/:id` existait déjà).

## Getters retournant une classe anonyme : annotation ComponentLike obligatoire

Un getter qui retourne une classe de composant créée dynamiquement doit annoter explicitement son type en `ComponentLike<Signature>` (`@glint/template`), sinon le build échoue silencieusement en `lint`.

`selectedOptionComponent(getOptions)` retourne une telle classe (fermeture sur `getOptions`) ; les trois getters `purposeSelectedItemComponent`, `legalBasisSelectedItemComponent`, `dataCategorySelectedItemComponent` portent cette annotation. Sans elle, `ember-tsc --declaration` (utilisé par `pnpm build`/`pnpm dev` via `build:watch`, pas par `lint:types` qui tourne en `--noEmit`) échoue avec `TS2883`/`TS4041` : le type inféré de la classe anonyme embarque des types internes de Glint non « nommables » dans un fichier `.d.ts` public. Trou détecté uniquement en lançant `pnpm dev` en réel, invisible via `lint`/`test`/`lat check`.

## Enregistrement obligatoire des schémas warp-drive

Un schéma warp-drive (`PurposeSchema`, `LegalBasisSchema`, `DataCategorySchema`...) doit être ajouté au tableau `schemas` de `useLegacyStore` dans `@apps/front/app/services/store.ts`, sinon le store lève `Missing Resource Type` au premier fetch.

Ce trou est silencieux dans les tests de composant (qui passent les données en `@args`, sans jamais toucher le store) : `lat check`, les tests unitaires/intégration et le typecheck ne le détectent pas. Il n'a été découvert que par la vérification manuelle en navigateur de ce goal — les schémas `purposes`/`legal-bases`/`data-categories` existaient (fichiers, mocks MSW, routes backend) mais n'avaient jamais été enregistrés dans `store.ts`. Vérifier systématiquement l'enregistrement à chaque nouveau type de ressource warp-drive.

Réapparu une 4ᵉ fois en branchant `incident-registry-front` (`IncidentSchema` manquant) — voir [[front-integration]] pour la checklist complète de branchement d'une lib `*-front`, dont ce point fait désormais partie.

## Contrat dataCategories en CSV

`dataCategories` est stocké dans le changeset comme une chaîne CSV de codes du référentiel, pas comme un tableau, pour matcher le contrat existant d'`AccessRecordService`.

`AccessRecordService` scinde la CSV en tableau côté backend (`dataCategories: array(string()).min(1)`). Voir [[@libs/access-registry-front/src/changesets/access-record.ts#DraftAccessRecord]].

## Validation relâchée pour les champs référentiels

`legalBasis` (et `purpose`, `dataCategories`) sont validés côté zod avec un simple `string().min(1)`, pas un `z.enum(...)`.

L'ensemble des codes valides n'est connu qu'au chargement du référentiel (runtime), pas à la construction du schéma de validation (qui ne reçoit que `intl`). La validité du choix est garantie par le select fermé (seules les options chargées sont proposées), pas par le schéma.

## Bug connu — TpkSelect en mode multiple

`@triptyk/ember-input@4.0.0-alpha.1` : `TpkSelect` avec `@multiple={{true}}` mappe en interne vers `@multiple={{undefined}}` de power-select, qui repasse alors en mode single-select et déclenche `onChange` avec une seule option plutôt qu'un tableau.

Contournement actuel : `setDataCategories` accepte les deux formes (tableau réel ou option unique) et bascule manuellement le code dans/hors de la CSV existante pour simuler un multi-select fonctionnel. À supprimer si la lib corrige ce comportement en amont — vérifier lors d'une montée de version de `@triptyk/ember-input`.
