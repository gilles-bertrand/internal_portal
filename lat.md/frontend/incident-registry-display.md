# Affichage incident aligné sur le registre d'accès

Le registre d'incidents rendait ses valeurs machine brutes là où le registre d'accès traduit et met en forme. L'alignement se fait sur `access-record-table.gts` / `access-record-detail.gts`, pris comme référence UX.

## Options métier traduites, code persisté

Les quatre enums incident (`status`, `classification`, `environment`, `severity`) n'ont pas de référentiel backend, contrairement aux `purpose`/`legalBasis`/`dataCategories` du registre d'accès : ils vivent dans [[@libs/incident-registry-front/src/utils/incident-options.ts#INCIDENT_STATUSES]].

Même « approche B » que `accessType` ([[access-record-options#Référentiels dynamiques vs enum statique]]) : la valeur **persistée** reste le code stable (`in_progress`, `CONFIDENTIEL`), seul l'affichage passe par `incidents.options.<enum>.<code>`. Rendus bruts, ces codes affichaient du snake_case et des mots français dans une UI anglaise. `optionLabel` retombe sur le code si la clé n'existe pas : un code historique reste lisible au lieu d'afficher un marqueur de traduction manquante.

Les options de select/filtre sont construites par `labelledOption`, dont le `toString` est **obligatoire** : power-select rend chaque option via `String(option)` et afficherait sinon `[object Object]`.

## Cellules de table personnalisées

`TableGenericPrefab` stringifie chaque valeur (`String(value)`) : toute colonne non triviale a donc besoin d'un composant de cellule, déclaré via `component:` + `@columnsComponent`. Même mécanisme que `SpecialCategoryCell` côté registre d'accès.

Sans cela la liste affichait `open` / `in_progress` non traduits, `true` / `false` pour l'article 9, une date ISO brute, et surtout le texte littéral **`null`** dans la colonne « état » sur chaque ligne non supprimée (`String(null)`). Les quatre cellules de `IncidentTable` (`@libs/incident-registry-front/src/components/incident-table.gts`) couvrent statut, article 9, date de déclaration et badge « supprimé ».

## Gating par ability, pas par nom de rôle

Le bouton de création était conditionné à `roleName === 'encoder'` ; il l'est désormais à `ability.can('create', 'Incident')`.

Comparer une chaîne de rôle dérive fatalement des règles CASL en base : un rôle futur autorisé à créer ne verrait pas le bouton alors que la route l'accepte. L'export du registre reste conditionné à `read Incident`, ce que la route backend `POST /incidents/export` exige réellement — le masquer aux encodeurs/auditeurs, comme le fait le registre d'accès pour son propre export réservé au DPO, leur retirerait une capacité que le serveur leur accorde.

## Vue détail complète

`IncidentDetail` reprend la structure de `access-record-detail.gts` : lien de retour fléché, carte d'en-tête à badges, sections `card` contenant des `<dl>` en deux colonnes, et section traçabilité.

Fichier : `@libs/incident-registry-front/src/components/incident-detail.gts`.

La vue précédente n'affichait que 4 champs sur ~45 : ni dates, ni sévérités, ni chronologie, ni actions correctives, ni signatures, ni empreintes de chaîne. Toutes les dates passent par un formateur unique (locale active, `dateStyle: medium`), toute valeur vide par `incidents.detail.empty`, et `prevHash` tout à zéro s'affiche comme premier maillon de la chaîne plutôt que comme une fausse empreinte. Les composants de présentation sont extraits dans `incident-detail-parts.gts` pour tenir les limites de taille de fichier.
