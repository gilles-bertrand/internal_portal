# Access Registry — règles métier backend

Règles métier spécifiques au registre d'accès (`@libs/access-registry-backend`), au-delà du mécanisme générique de hash-chain documenté dans [[hash-chain-integrity]].

## RBAC : séparation des rôles

Quatre rôles (`encoder`, `dpo`, `auditor`, `tech_admin`) avec des permissions strictement disjointes sur le registre d'accès — modélise une séparation des devoirs typique RGPD.

Piloté par CASL via `request.ability`, plus par comparaison de string — cf. [[permissions#Attachement de request.ability au chargement de l'utilisateur]].

`tech_admin` est explicitement interdit sur tout le module registre via un hook `preHandler` global ([[@libs/access-registry-backend/src/init.ts#Module]]) — même authentifié, ce rôle n'a pas accès au contenu du registre : décision de sécurité volontaire, pas un oubli de scope.

`encoder` est seul autorisé à créer un enregistrement ([[@libs/access-registry-backend/src/routes/create.route.ts#CreateRoute]]) ; en lecture, il ne voit que ses propres enregistrements (`encodedBy = user.id`) — un encoder ne peut jamais parcourir tout le registre. `dpo` et `auditor` voient tout le registre en lecture. `auditor` et `dpo` sont seuls autorisés à appeler `verify-integrity`. `dpo` seul peut déclencher `retention/run` (purge).

## Guard de groupe CASL sans requirePermission générique

Le hook `preHandler` global du module ne peut pas être un simple `requirePermission("read", "AccessRecord")` — `encoder` n'a que `create` (pas `read` non conditionné) sur ce subject, ce qui le bloquerait à tort sur `CreateRoute`.

À la place, [[@libs/access-registry-backend/src/init.ts#Module]] détecte spécifiquement la règle `cannot("manage", "AccessRecord")` seedée pour `tech_admin` via `request.ability.rulesFor("manage", "AccessRecord").some(rule => rule.inverted)` — précis (ne matche que tech_admin) sans dépendre du nom du rôle. Chaque route affine ensuite avec son propre `requirePermission(action, subject)`.

## Guards manquants comblés sur list/export/stats/audit-events

Seul `get.route.ts` (et create/verify-integrity/retention-run) portait un `requirePermission` explicite — `list`/`export`/`stats`/`audit-events` n'avaient aucun guard propre, protégés seulement par le hook de groupe qui ne bloque que `tech_admin`.

Un futur rôle custom sans droit `read AccessRecord` aurait donc pu lister/exporter/consulter les stats et le méta-journal du registre. Corrigé en ajoutant `preHandler: [requirePermission("read", "AccessRecord")]` à ces quatre routes, identique au pattern de `get.route.ts` — `encoder`/`dpo`/`auditor` gardent leur accès (règle `read AccessRecord`, conditionnée ou non, satisfait le check de type), seul `tech_admin` reste bloqué (déjà via le hook de groupe). Testé par la matrice `describe.each` de [[@libs/access-registry-backend/tests/integration/permission-separation.test.ts]] et [[@libs/access-registry-backend/tests/integration/permission-separation-reads.test.ts]] (scindé en deux fichiers pour rester sous la limite de lignes lint).

## Vérification row-level via subject() sur get.route.ts

`GetRoute` ([[@libs/access-registry-backend/src/routes/get.route.ts#GetRoute]]) autorise l'accès au niveau route via `requirePermission("read", "AccessRecord")`, satisfait par la règle conditionnée d'`encoder` car un check de type ignore les `conditions`.

Après le fetch, la condition réelle est vérifiée avec `ability.can("read", subject("AccessRecord", record))` — `subject()` (`@casl/ability`) tague l'instance pour que CASL évalue `encodedBy: "$user.id"` contre le record chargé.

## Filtre de liste dérivé de la condition CASL de l'encoder

`ListRoute` ne compare plus `user.role.name === "encoder"` en dur — [[@libs/access-registry-backend/src/utils/extract-equality-condition.ts#extractEqualityCondition]] lit la règle `read AccessRecord` de l'ability à la recherche d'une condition d'égalité sur `encodedBy`.

Si la condition existe (cas de l'encoder), elle force le filtre ; sinon (dpo/auditor) le filtre `filter[encodedBy]` explicite de la query reste appliqué tel quel, comportement inchangé.

## Règle art. 9 RGPD (données sensibles)

La création d'un accès à une catégorie de donnée "spéciale" (art. 9 RGPD, ex. santé) impose une base légale art. 9.2 explicite, indépendamment du front.

Dans [[@libs/access-registry-backend/src/routes/create.route.ts#CreateRoute]], si `isSpecialCategory === true`, `legalBasis` doit être l'un des codes `art9.2a` à `art9.2j` — sinon 400 `MISSING_ART9_BASIS`. Cette liste est en dur dans la route, pas dérivée du référentiel `LegalBasisEntity.isArticle9` — un désalignement entre le référentiel DB et cette liste est possible si de nouveaux motifs art.9 sont ajoutés en base sans mise à jour de la route.

Règle complémentaire : `accessType === "transmission"` exige un `recipient` non vide (400 `MISSING_RECIPIENT`) — traçabilité du destinataire pour toute transmission à un tiers.

## Rétention et archivage (sans suppression physique)

Les enregistrements échus ne sont jamais supprimés physiquement — ils sont archivés (export signé) car la suppression casserait la chaîne de hash ; la purge réelle reste une opération DBA hors application.

Durée par défaut : 5 ans ([[@libs/access-registry-backend/src/utils/append.service.ts#AppendService]]), calculée à l'écriture à partir de la première `dataCategory` et d'un éventuel `RetentionPolicyEntity` correspondant. Aucune donnée de seed ne peuple `RetentionPolicyEntity` en dev — tous les enregistrements retombent donc sur le défaut de 5 ans tant qu'aucune policy n'est créée manuellement en DB.

[[@libs/access-registry-backend/src/routes/retention-run.route.ts#RetentionRunRoute]] (rôle dpo uniquement) sélectionne les enregistrements échus, les exporte (JSON signé), journalise un événement `RETENTION_PURGE`, et renvoie `purged: 0` en dur — la purge physique est volontairement différée à une opération DBA distincte, pour ne jamais casser la chaîne append-only.

## Export signé multi-format (JSON/CSV/PDF)

Tout export du registre embarque un manifeste signé HMAC-SHA256 et un statut d'intégrité de chaîne calculé à la volée, garantissant qu'un export ne peut pas mentir sur l'état du registre.

[[@libs/access-registry-backend/src/utils/export.service.ts#ExportService]] recalcule systématiquement `verifyAccessRecordChain` sur les enregistrements à exporter (pas de cache), construit un manifeste (`generatedAt`, `chainHeadHash`, `contentSha256`, `integrityOk`), puis signe le contenu brut avec `EXPORT_SIGNING_KEY` — la signature couvre le contenu, donc toute modification du fichier exporté est détectable. Le CSV embarque une ligne d'en-tête `# integrity:OK|BROKEN` ; le PDF ([[@libs/access-registry-backend/src/utils/export-pdf.ts#buildPdf]]) rend une "Attestation d'intégrité" visuelle pensée pour un contrôle CNIL/DPO sans outillage technique. Réutilisé tel quel par `retention/run` pour l'archive de purge — un seul point de génération de manifeste signé pour les deux cas d'usage.

## Méta-journal d'audit (accès en lecture tracés)

Toute lecture ou écriture significative du registre génère un événement dans le journal d'audit — même une simple consultation de liste déclenche `REGISTRY_VIEWED`.

Cohérent avec l'esprit "registre des accès" : on trace aussi qui consulte le registre lui-même, pas seulement qui le modifie.

Actions tracées : `REGISTRY_CREATED`, `REGISTRY_VIEWED` (list et get), `REGISTRY_EXPORTED`, `RETENTION_PURGE`. La route [[@libs/access-registry-backend/src/routes/audit-events.route.ts#AuditEventsRoute]] trie par `seq DESC` — le méta-journal est chronologique inversé (plus récent en premier), contrairement au registre d'accès qui trie par `seq ASC`.

## Référentiels RGPD (data-categories / purposes / legal-bases)

Les catégories de données, finalités et bases légales sont des entités DB dédiées exposées en lecture seule, pas des enums en dur côté front — complète [[access-record-options|le pattern front de sélection traduite]].

Chaque référentiel a un `code` unique (valeur de contrat API/DB stable) et un `label` traduit (cosmétique). `LegalBasisEntity.isArticle9` distingue les bases "art.9" des bases "art.6" standard, mais ce champ n'est actuellement pas consommé par la validation de `CreateRoute` (qui recode sa propre liste de préfixes, cf. section art. 9 ci-dessus) — un point de vigilance en cas d'évolution du référentiel. Aucune donnée de seed ne peuple `RetentionPolicyEntity`, contrairement aux trois autres référentiels qui sont peuplés en dev ([[@apps/backend/src/seeders/development.seeder.ts#DatabaseSeeder]]).

## Référentiel source-systems (creatable)

`SourceSystemEntity` ([[@libs/access-registry-backend/src/entities/source-system.entity.ts#SourceSystemEntity]]) est un référentiel `{ code, label }` comme purposes/legal-bases, mais **creatable** : un encodeur peut en ajouter à la volée depuis le formulaire, sans passer par une UI d'admin.

[[@libs/access-registry-backend/src/routes/source-systems.route.ts#SourceSystemsRoute]] expose `GET /source-systems` (lecture, groupe référentiels). [[@libs/access-registry-backend/src/routes/source-systems.route.ts#CreateSourceSystemRoute]] expose `POST /source-systems`, gardé `requirePermission("create", "AccessRecord")` : créer un système est un acte d'encodage, pas d'administration. Le `code` est dérivé du `label` par [[@libs/access-registry-backend/src/routes/source-systems.route.ts#slugifySourceSystem]] (minuscules, sans accents, tirets). Un libellé qui slugifie en chaîne vide (ponctuation/espaces seuls, ex. « !!! ») passe la validation `min(1)` mais est refusé par un **400 `INVALID_SOURCE_SYSTEM_LABEL`** — on ne crée pas de référentiel au code vide. La création est **idempotente** : un `code` déjà présent renvoie l'existant (200) plutôt qu'un 409, pour une UX de formulaire fluide. Pas de données de seed — le référentiel démarre vide et se remplit à l'usage. Testé par [[@libs/access-registry-backend/tests/integration/source-systems.route.test.ts]].

## Liste des accédants habilités (accessorRef)

[[@libs/access-registry-backend/src/routes/eligible-accessors.route.ts#EligibleAccessorsRoute]] expose `GET /eligible-accessors` : la liste des utilisateurs habilités à créer un enregistrement, destinée à peupler la select `accessorRef` du formulaire (le champ n'est plus un texte libre).

`GET /users` étant gardé `manage:User` (inaccessible à un encodeur), cet endpoint dédié est gardé `create:AccessRecord` et ne renvoie que `{ id, name }`. Les habilités sont dérivés des règles CASL en base : rôles avec une règle non-inversée `create`/`manage` sur `AccessRecord` (ou `all`), moins les rôles portant un `cannot manage AccessRecord` (ex. `tech_admin`). C'est une approximation suffisante pour une liste de suggestions — l'autorisation réelle reste appliquée par `requirePermission` sur le `POST`. Testé par [[@libs/access-registry-backend/tests/integration/eligible-accessors.route.test.ts]].
