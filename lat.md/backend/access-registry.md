# Access Registry — règles métier backend

Règles métier spécifiques au registre d'accès (`@libs/access-registry-backend`), au-delà du mécanisme générique de hash-chain documenté dans [[hash-chain-integrity]].

## RBAC : séparation des rôles

Quatre rôles (`encoder`, `dpo`, `auditor`, `tech_admin`) avec des permissions différenciées sur le registre d'accès — modélise une séparation des devoirs typique RGPD.

Piloté par CASL via `request.ability`, plus par comparaison de string — cf. [[permissions#Attachement de request.ability au chargement de l'utilisateur]].

`tech_admin` accède au registre d'accès **en lecture** (règle `read AccessRecord`) : list/get/export/stats/audit-events (200), mais ne peut ni créer, ni vérifier l'intégrité, ni purger. Le registre des **incidents** lui reste interdit (`manage Incident` inversé).

`encoder` est seul autorisé à créer un enregistrement ([[@libs/access-registry-backend/src/routes/create.route.ts#CreateRoute]]) ; en lecture, il ne voit que ses propres enregistrements (`encodedBy = user.id`) — un encoder ne peut jamais parcourir tout le registre. `dpo` et `auditor` voient tout le registre en lecture. `auditor` et `dpo` sont seuls autorisés à appeler `verify-integrity`. `dpo` seul peut déclencher `retention/run` (purge).

## Guard de groupe CASL sans requirePermission générique

Le hook `preHandler` global du module ne peut pas être un simple `requirePermission("read", "AccessRecord")` — `encoder` n'a que `create` (pas `read` non conditionné) sur ce subject, ce qui le bloquerait à tort sur `CreateRoute`.

À la place, [[@libs/access-registry-backend/src/init.ts#Module]] rejette tout rôle portant un `cannot("manage", "AccessRecord")` via `request.ability.rulesFor("manage", "AccessRecord").some(rule => rule.inverted)` — défense générique (sans dépendre du nom du rôle). Depuis que `tech_admin` a `read AccessRecord` (et non plus `manage` inversé), **aucun rôle seedé ne déclenche ce guard** ; il reste comme garde-fou pour un futur rôle interdit. Chaque route affine ensuite avec son propre `requirePermission(action, subject)`.

## Guards manquants comblés sur list/export/stats/audit-events

Seul `get.route.ts` (et create/verify-integrity/retention-run) portait un `requirePermission` explicite — `list`/`export`/`stats`/`audit-events` n'avaient aucun guard propre, protégés seulement par le hook de groupe.

Un futur rôle custom sans droit `read AccessRecord` aurait donc pu lister/exporter/consulter les stats et le méta-journal du registre. Corrigé en ajoutant `preHandler: [requirePermission("read", "AccessRecord")]` à ces quatre routes, identique au pattern de `get.route.ts` — `encoder`/`dpo`/`auditor`/`tech_admin` gardent leur accès (règle `read AccessRecord`, conditionnée ou non, satisfait le check de type). Testé par la matrice `describe.each` de [[@libs/access-registry-backend/tests/integration/permission-separation.test.ts]] et [[@libs/access-registry-backend/tests/integration/permission-separation-reads.test.ts]] (scindé en deux fichiers pour rester sous la limite de lignes lint).

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

## Export PDF : liste puis détail

Le PDF s'ouvre sur une **liste récapitulative** (une ligne compacte par enregistrement, en page 1 sous l'attestation) puis, à partir d'une nouvelle page, le **détail complet** (une fiche par enregistrement, tous les champs sans troncature).

La liste ([[@libs/access-registry-backend/src/utils/pdf-table.ts#drawSummaryTable]]) utilise [[@libs/access-registry-backend/src/utils/pdf-summary.ts#buildSummaryCells]] (colonnes `SUMMARY_COLUMNS` : seq, date, personne, type, finalité, art. 9, système source, hash abrégé). Le détail ([[@libs/access-registry-backend/src/utils/pdf-detail-render.ts#drawRecordsDetail]]) utilise [[@libs/access-registry-backend/src/utils/pdf-detail.ts#buildRecordDetailRows]] — liste exhaustive label→valeur (séquence, dates d'accès/encodage, encodeur, accédant, personne concernée, catégories, art. 9, type, finalité, base légale, système source, destinataire, justification, conservation, `prevHash` et `hash` **complets**) rendue en blocs encadrés, un bloc jamais coupé entre deux pages.

Densité : dans chaque fiche, les champs courts sont disposés sur **2 colonnes** et seuls les hash occupent la pleine largeur — ce qui réduit fortement la hauteur d'une fiche (≈ 3-4 fiches par page au lieu de 2) et donc le nombre de pages.

Piège pdfkit sur le pied de page : le footer (« Page X / Y ») s'écrit **sous la marge basse**, et le line-wrapper de pdfkit — activé dès qu'une `width` est passée à `text()`, ici pour l'alignement à droite — y voyait un dépassement de `maxY` et déclenchait un `addPage()` par footer posé : le PDF gonflait d'autant de pages fantômes ne contenant que le numéro de page. `drawPageFooter` (`export-pdf.ts`) neutralise `doc.page.margins.bottom` le temps du dessin puis la restaure. Régression couverte par [[@libs/access-registry-backend/tests/unit/export-pdf.test.ts]] (comptage des `/Type /Page` du buffer : export vide = 1 page exactement). Les fonctions pures sont testées unitairement ([[@libs/access-registry-backend/tests/unit/pdf-detail.test.ts]], [[@libs/access-registry-backend/tests/unit/pdf-summary.test.ts]]) ; le rendu binaire reste couvert par le smoke test d'intégration (`%PDF`, intégrité). En-tête, cartes de stats et attestation d'intégrité sont conservés.

## Périmètre d'export par source system

`POST /export` accepte un paramètre optionnel `sourceSystem` (code du référentiel) pour restreindre l'export aux accès de ce système ; absent/null exporte tout le registre.

[[@libs/access-registry-backend/src/routes/export.route.ts#ExportRoute]] valide côté serveur que le code correspond à un `SourceSystem` existant (sinon **404** `SOURCE_SYSTEM_NOT_FOUND`) puis applique le filtre `where: { sourceSystem }` sur `findAll` — le filtrage n'est jamais uniquement côté front. Le champ filtré est le `sourceSystem` (code) déjà porté par `access_record`, aucun nouveau champ. Côté front, l'export du registre demande le périmètre via une modale (un source system précis ou « tous ») sans défaut implicite — cf. [[apps/e2e-strategy#Export des accès par périmètre source system]]. Testé par [[@libs/access-registry-backend/tests/integration/export-scope.route.test.ts]].

Point d'intégrité crucial : un sous-ensemble filtré n'est **pas** une chaîne contiguë (les `prevHash` ne s'enchaînent pas depuis `GENESIS_HASH`). L'attestation d'intégrité ne doit donc pas être calculée sur le sous-ensemble — sinon un export filtré s'affiche à tort « BROKEN » dans le PDF. `ExportRoute` recharge la chaîne **complète** du registre et la passe à `ExportService.build` via le paramètre `integrityRecords` : le manifeste (`integrityOk`, `chainHeadHash`) certifie l'état du registre, tandis que le contenu exporté (`count`, `data`) reste le sous-ensemble filtré.

## Méta-journal d'audit (accès en lecture tracés)

Toute lecture ou écriture significative du registre génère un événement dans le journal d'audit — même une simple consultation de liste déclenche `REGISTRY_VIEWED`.

Cohérent avec l'esprit "registre des accès" : on trace aussi qui consulte le registre lui-même, pas seulement qui le modifie.

Actions tracées : `REGISTRY_CREATED`, `REGISTRY_VIEWED` (list et get), `REGISTRY_EXPORTED`, `RETENTION_PURGE`. La route [[@libs/access-registry-backend/src/routes/audit-events.route.ts#AuditEventsRoute]] trie par `seq DESC` — le méta-journal est chronologique inversé (plus récent en premier), contrairement au registre d'accès qui trie par `seq ASC`.

## Référentiels RGPD (data-categories / purposes / legal-bases)

Les catégories de données, finalités et bases légales sont des entités DB dédiées exposées en lecture seule, pas des enums en dur côté front — complète [[access-record-options|le pattern front de sélection traduite]].

Chaque référentiel a un `code` unique (valeur de contrat API/DB stable) et des libellés d'affichage bilingues (cf. [[access-registry#Référentiels bilingues (label / labelEn)]]). `LegalBasisEntity.isArticle9` distingue les bases "art.9" des bases "art.6" standard, mais ce champ n'est actuellement pas consommé par la validation de `CreateRoute` (qui recode sa propre liste de préfixes, cf. section art. 9 ci-dessus) — un point de vigilance en cas d'évolution du référentiel. Aucune donnée de seed ne peuple `RetentionPolicyEntity`, contrairement aux trois autres référentiels qui sont peuplés en dev ([[@apps/backend/src/seeders/development.seeder.ts#DatabaseSeeder]]).

## Référentiels bilingues (label / labelEn)

Les quatre référentiels (data-categories, purposes, legal-bases, source-systems) portent deux libellés : `label` (français, jamais nul) et `labelEn` (anglais, nullable), tous deux sérialisés.

L'API expose les **deux** libellés plutôt qu'un seul résolu via `Accept-Language` : le sélecteur de langue du dashboard change la locale sans rechargement, donc un libellé figé au fetch resterait dans l'ancienne langue. La résolution appartient au frontend — voir [[frontend/access-record-options#Libellés bilingues résolus côté frontend]].

`labelEn` est nullable pour deux raisons : les systèmes sources créés depuis le formulaire n'ont que le libellé saisi par l'utilisateur, et les bases antérieures à la colonne ont des lignes non traduites. [[@apps/backend/src/seeders/seed-data/referentials.ts#seedReferentials]] renseigne les traductions manquantes des référentiels connus à chaque exécution du seeder de dev, ce qu'une simple insertion idempotente ne ferait pas (elle ne touche pas une ligne existante). Ce module est la source unique des données de seed, partagée avec [[@apps/backend/src/seeders/e2e.seeder.ts#E2ESeeder]] ; les tests backend en gardent une copie propre dans `tests/global-setup.ts`, la lib ne pouvant pas dépendre de l'app.

⚠️ Ne pas appliquer la colonne avec `pnpm schema:update --run` : le diff généré **supprime aussi les triggers d'inaltérabilité** (`access_record_no_mutation`, `audit_event_no_mutation`, `incident_no_mutation`, `incident_no_delete`), que MikroORM ne connaît pas. Appliquer le seul `ALTER TABLE ... ADD COLUMN label_en varchar(255) NULL` sur les quatre tables.

## Référentiel source-systems (creatable)

`SourceSystemEntity` ([[@libs/access-registry-backend/src/entities/source-system.entity.ts#SourceSystemEntity]]) est un référentiel `{ code, label }` comme purposes/legal-bases, mais **creatable** : un encodeur peut en ajouter à la volée depuis le formulaire, sans passer par une UI d'admin.

[[@libs/access-registry-backend/src/routes/source-systems.route.ts#SourceSystemsRoute]] expose `GET /source-systems` (lecture, groupe référentiels). [[@libs/access-registry-backend/src/routes/source-systems.route.ts#CreateSourceSystemRoute]] expose `POST /source-systems`, gardé `requirePermission("create", "AccessRecord")` : créer un système est un acte d'encodage, pas d'administration. Le `code` est dérivé du `label` par [[@libs/access-registry-backend/src/routes/source-systems.route.ts#slugifySourceSystem]] (minuscules, sans accents, tirets). Un libellé qui slugifie en chaîne vide (ponctuation/espaces seuls, ex. « !!! ») passe la validation `min(1)` mais est refusé par un **400 `INVALID_SOURCE_SYSTEM_LABEL`** — on ne crée pas de référentiel au code vide. La création est **idempotente** : un `code` déjà présent renvoie l'existant (200) plutôt qu'un 409, pour une UX de formulaire fluide. La fenêtre de course entre le `findOne` et l'`insert` (deux requêtes concurrentes pour un même code neuf) est rattrapée par un `try/catch` sur `UniqueConstraintViolationException` qui re-lit et renvoie l'existant. Pas de données de seed — le référentiel démarre vide et se remplit à l'usage. Testé par [[@libs/access-registry-backend/tests/integration/source-systems.route.test.ts]].

## Détail : nom d'affichage de l'encodeur

`GET /access-records/:id` ([[@libs/access-registry-backend/src/routes/get.route.ts#GetRoute]]) enrichit la réponse d'un attribut `encodedByName` : le nom résolu de l'utilisateur encodeur, pour l'afficher dans la vue détail plutôt que l'UUID brut de `encodedBy`.

La route charge l'utilisateur via `em.getRepository(UserEntity)` (obtenu depuis `this.repository.getEntityManager()`) et résout le nom avec [[@libs/access-registry-backend/src/utils/user-display.ts#userNameFor]] (fallback = l'id si l'utilisateur est introuvable). `encodedByName` est **optionnel** dans `SerializedAccessRecordSchema` — seul le GET単 le fournit ; `list`/`create` renvoient l'enregistrement brut. Côté front, le schéma WarpDrive `AccessRecord` porte `encodedByName?` et le composant détail affiche `encodedByName ?? encodedBy`.

## Liste des accédants habilités (accessorRef)

[[@libs/access-registry-backend/src/routes/eligible-accessors.route.ts#EligibleAccessorsRoute]] expose `GET /eligible-accessors` : la liste des utilisateurs habilités à créer un enregistrement, destinée à peupler la select `accessorRef` du formulaire (le champ n'est plus un texte libre).

`GET /users` étant gardé `manage:User` (inaccessible à un encodeur), cet endpoint dédié est gardé `create:AccessRecord` et ne renvoie que `{ id, name }`. Les habilités sont dérivés des règles CASL en base : rôles avec une règle non-inversée `create`/`manage` sur `AccessRecord` (ou `all`), moins les rôles portant un `cannot manage AccessRecord`. `tech_admin` n'y figure pas : il n'a que `read AccessRecord` (ni `create`/`manage`), donc filtré d'office. C'est une approximation suffisante pour une liste de suggestions — l'autorisation réelle reste appliquée par `requirePermission` sur le `POST`. Testé par [[@libs/access-registry-backend/tests/integration/eligible-accessors.route.test.ts]].
