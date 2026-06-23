# Plan — Fidélité du rapport d'incident PDF au document de référence OCM

> Objectif : faire en sorte que le PDF généré par `buildIncidentPdf` reproduise **au plus près** le rapport
> de référence `2026-04-03_Rapport_Incident_OCM_INC-2026-0403.pdf`, adapter les modèles pour porter
> toutes les données nécessaires, et créer le jeu de données d'exemple (« la liste ») dérivé de
> l'annexe de logs `..._Annexe.log`.

## 1. Problème et objectifs

Le générateur PDF actuel (`@libs/incident-registry-backend/src/utils/export-incident-pdf.ts`) produit un
document fonctionnel mais **très éloigné** du rapport officiel de référence :

- Titres de sections au format `§1 — …` au lieu de `1. Objet et cadre légal`, `2. …` numérotés.
- Sous-sections (`descriptionSections`, `communicationPlan`, signatures) sérialisées en brut via
  `JSON.stringify(...)` → illisibles.
- Aucune table structurée : le tableau d'informations générales, la chronologie et l'annexe des accès
  sont rendus en lignes de texte concaténées.
- Pas de bandeau « RAPPORT D'INCIDENT », pas de mention `CONFIDENTIEL`, pas de bloc signatures à deux
  colonnes, pas de pied de page conforme.

À l'inverse, le **modèle de données (entité) est déjà riche** et couvre la quasi-totalité des champs du
rapport. Le gros du travail porte donc sur le **rendu PDF**, avec quelques **ajustements de modèle** pour
structurer proprement les signatures et les sous-sections.

### Document de référence — structure cible (4 pages)

| § | Section | Rendu attendu |
|---|---------|---------------|
| — | En-tête | Bandeau bleu « RAPPORT D'INCIDENT » + sous-bandeau « Application OCM — … » + table 11 lignes (label gras / valeur) |
| 1 | Objet et cadre légal | 2 paragraphes |
| 2 | Informations générales | Table label/valeur (10 lignes) |
| 3 | Description de l'incident | 3 paragraphes + **3.1 Documents concernés** (puces) + **3.2 Patient concerné** |
| 4 | Impact de l'incident | **4.1 Nature de l'impact** (puces) + **4.2 Évaluation de la criticité** (puces) |
| 5 | Chronologie des événements | Table 3 colonnes (Date / Heure / Événement) avec en-tête bleu |
| 6 | Analyse des causes | **6.1 Cause immédiate** (paragraphe) |
| 7 | Mesures prises et correctifs | **7.1 Phase 1** / **7.2 Phase 2** / **7.3 Mesures préventives**, listes numérotées continues |
| 8 | Conclusion | 4 paragraphes |
| 9 | Annexes — Détail des accès (logs) | Table 5 colonnes (Date / Utilisateur / Email / Fichiers accédés / Nb accès) + ligne **Total** en italique |
| 10 | Approbation et signatures | Bloc 2 colonnes (Émetteur / Destinataire) avec en-tête bleu, champs Nom/Fonction/Société‑Organisation/Date/Signature |
| — | Pied de page | `Triptyk SRL — Rapport d'incident INC-2026-0403-OCM — Version 1.0 — 03/04/2026 | Page N` + `CONFIDENTIEL` en haut à droite (rouge, italique) |

## 2. Approche technique

### Architectural Context (advisory)
- **Communautés touchées** : `incident-registry-backend` (entité, sérialiseur, util PDF, seed côté
  `@apps/backend`), `incident-registry-front` (schéma WarpDrive, formulaire — uniquement si l'on ajoute
  des champs structurés au formulaire).
- **Contrats transverses** : `makeJsonApiDocumentSchema` (sérialiseur) — toute modification d'attribut
  doit rester cohérente entre `incident.entity.ts`, `incident.serializer.ts` et `schemas/incidents.ts`
  (front). La **chaîne d'intégrité par hash** (`prevHash`/`hash`) calcule l'empreinte sur les attributs :
  vérifier que de nouveaux champs ou un changement de forme JSON n'invalident pas la vérification
  d'intégrité (cf. `utils/integrity.ts` + `verify-integrity.route.ts`).
- ⚠️ Aucune migration de colonne SQL n'est nécessaire : `descriptionSections`, `impactDetails`,
  `issuerSignature`, `recipientSignature` sont déjà des colonnes `json`. On **resserre seulement les
  types TypeScript**, sans changer le schéma physique de la table `incident` (qui est append-only).

### Décisions de conception
1. **Aucune nouvelle colonne DB.** On réutilise les colonnes JSON existantes en typant leur contenu.
2. **PDF entièrement piloté par le modèle** : le générateur doit produire la structure cible pour
   n'importe quel incident, pas seulement OCM (pas de valeurs en dur).
3. **Helpers de rendu réutilisables** : introduire des primitives (`drawConfidentialBanner`,
   `drawTitleBlock`, `drawKeyValueTable`, `drawDataTable`, `drawSubSection`, `drawBulletList`,
   `drawNumberedList`, `drawSignatureBlock`, `drawReportFooter`) dans `export-incident-pdf.ts`.
4. **Format de dates** : le rapport utilise `JJ/MM/AAAA` et `XXhYY`. Ajouter `formatDateFr(iso)` →
   `03/04/2026` et `formatDateTimeFr` → `03/04/2026 à 09h47`. La table chronologie utilise les champs
   `date`/`time` déjà fournis tels quels.

### Modèle — ajustements de typage (sans migration)
Dans `incident.entity.ts` (types `InferEntity`) + miroir dans `incident.serializer.ts` (Zod) +
`schemas/incidents.ts` (front) :

```ts
// descriptionSections : sous-sections à puces (3.1, 3.2, …)
descriptionSections: p.json<{ title: string; body?: string; items?: string[] }[]>().nullable(),

// impactDetails : nature + criticité (4.1 / 4.2)
impactDetails: p.json<{
  nature?: string[];               // 4.1 puces
  severityIntro?: string;          // « Impact global : Faible. »
  severityPoints?: string[];       // 4.2 puces
}>().nullable(),

// signatures : champs structurés pour le bloc §10
issuerSignature: p.json<{ name: string; role?: string; org?: string; date?: string }>(),
recipientSignature: p.json<{ name: string; role?: string; org?: string; date?: string }>(),
```

Côté Zod (`incident.serializer.ts`), remplacer les `z.unknown()` correspondants par des `object({...})`
optionnels-tolérants (garder une compat ascendante : `.passthrough()` ou champs `.optional()`), afin de
ne pas casser les incidents déjà sérialisés.

### « La liste » — jeu de données OCM dérivé de l'annexe
Remplacer le second incident générique du seeder (`@apps/backend/src/seeders/development.seeder.ts`,
lignes ~120‑202, « Dossier Patient OCM / compte compromis ») par l'incident **réel INC-2026-0403-OCM**,
fidèle au rapport, avec l'annexe d'accès **agrégée depuis le `.log`** :

| Date | Utilisateur | Email | Fichiers accédés | Nb accès |
|------|-------------|-------|------------------|----------|
| 02/04/2026 | Anne Herbiet | anne-sophie.herbiet@imaje-interco.be | Feuillet Patient + Feuillet Médecin | 5 |
| 02/04/2026 | Megane Frankinet | megane.frankinet@imaje-interco.be | Feuillet Médecin | 1 |
| 02/04/2026 | Marine Malaise | marine.malaise@imaje-interco.be | Feuillet Patient + Feuillet Médecin | 3 |
| 03/04/2026 | Nathalie Michel | nathalie.michel@imaje-interco.be | Feuillet Patient + Feuillet Médecin | 2 |

**Total : 11 accès par 4 utilisateurs distincts.**

> ⚠️ Note de cohérence : le `.log` brut contient **6** lignes pour Anne Herbiet (et 12 lignes au total),
> alors que le rapport officiel indique **5** (total 11). On **aligne le seed sur le document de
> référence** (source de vérité = le PDF officiel) et on consigne l'écart ici. À confirmer avec
> l'utilisateur si l'on préfère recompter depuis le log brut (6/1/3/2 = 12).

## 3. Guide d'implémentation pas à pas

### Phase 1 — Resserrer les modèles (backend + front)
1. `@libs/incident-registry-backend/src/entities/incident.entity.ts` : typer `descriptionSections`,
   `impactDetails`, `issuerSignature`, `recipientSignature` comme ci-dessus.
2. `@libs/incident-registry-backend/src/serializers/incident.serializer.ts` : remplacer les schémas Zod
   `z.unknown()` correspondants par des `object({...})` tolérants ; ajuster les casts dans
   `jsonApiSerializeIncident`.
3. `@libs/incident-registry-front/src/schemas/incidents.ts` : aligner le type `Incident`
   (`descriptionSections`, `impactDetails`, `issuerSignature`, `recipientSignature`).
4. Vérifier `utils/integrity.ts` : s'assurer que le calcul de hash sérialise déjà ces champs de façon
   stable (ordre des clés). Ne **pas** modifier l'algorithme, seulement confirmer.

### Phase 2 — Réécrire le générateur PDF par incident
Réécrire `@libs/incident-registry-backend/src/utils/export-incident-pdf.ts` :
1. Constantes couleurs alignées sur le document : `primary` bleu `#1F3864`/`#2E5496`, en-têtes de table
   bleu foncé, lignes alternées gris clair, `confidential` rouge `#C00000`.
2. Helpers de rendu :
   - `drawConfidentialBanner(doc)` — « CONFIDENTIEL » rouge italique, en haut à droite (appliqué à chaque
     page via `bufferedPageRange`).
   - `drawTitleBlock(doc, incident)` — bandeau bleu « RAPPORT D'INCIDENT » centré + sous-bandeau
     « Application … » + table 11 lignes (Référence, Date du rapport, Version, Classification,
     Application concernée, Environnement, Période de l'incident, Statut, Rapport établi par,
     Destinataire, Incident signalé par).
   - `drawKeyValueTable(doc, rows)` — table 2 colonnes (label gras / valeur), lignes alternées, gestion
     du saut de page.
   - `drawDataTable(doc, columns, rows, { headerFill })` — table générique avec en-tête bleu, utilisée
     pour la chronologie (§5) et l'annexe (§9) ; largeurs de colonnes paramétrables, retour à la ligne
     dans les cellules, répétition de l'en-tête après saut de page.
   - `drawSection(doc, n, title)` / `drawSubSection(doc, n, title)` — titres numérotés bleus.
   - `drawBulletList` / `drawNumberedList(startIndex)`.
   - `drawSignatureBlock(doc, issuer, recipient)` — 2 colonnes, en-tête bleu « Émetteur du rapport » /
     « Destinataire », champs Nom/Fonction/Société(ou Organisation)/Date + ligne « Signature : ____ ».
   - `drawReportFooter(doc, incident, pageIndex, pageCount)` — `Triptyk SRL — Rapport d'incident {ref} —
     Version {version} — {reportDate} | Page N`.
3. Composer le document section par section selon la table cible (§1→§10) en consommant **les champs du
   modèle** (`legalContext`, table d'infos depuis les champs scalaires, `description` +
   `descriptionSections`, `impactSummary` + `impactDetails`, `timelineEvents`, `immediateCause`,
   `correctiveActions` groupés par `phase` + `preventiveMeasures`, `conclusion`, `accessLogs` + total
   calculé, `issuerSignature`/`recipientSignature`).
4. Calculer la ligne « Total : N accès par M utilisateurs distincts » depuis `accessLogs`
   (`sum(count)` et `accessLogs.length`).
5. Gérer proprement les champs absents (`null`) → afficher `—` ou masquer la sous-section.

### Phase 3 — « La liste » : seed de l'incident OCM réel
1. Dans `@apps/backend/src/seeders/development.seeder.ts`, remplacer le bloc OCM générique (~125‑202)
   par les valeurs fidèles au rapport :
   - `reference: "INC-2026-0403-OCM"`, `reportDate: "2026-04-03"`, `version: "1.0 — Version initiale"`,
     `classification: "CONFIDENTIEL"`, `status` → libellé « Résolu (Phase 1) » (vérifier le mapping
     statut↔libellé attendu côté PDF).
   - `applicationName: "OCM — Portail Extranet Entreprises Clientes"`, `serviceName: "Consultation des
     feuillets médicaux (résultats de contrôle)"`, `environment: "production"`, `clientCode: "OCM"`.
   - `reportedBy: "Laetitia Manias (OCM) / Employé société IMAJE"`,
     `recipientName: "OCM — Direction"`, `recipientOrg: "OCM"`.
   - Dates : `incidentStartAt 2026-04-02T07:58`, `detectedAt 2026-04-03T09:13`,
     `resolvedAt 2026-04-03T09:47`, `resolutionDurationMinutes: 34`.
   - `legalContext`, `description` (3 paragraphes), `descriptionSections` (3.1 Documents concernés /
     3.2 Patient concerné), `impactSummary` + `impactDetails` (4.1/4.2), `immediateCause`,
     `correctiveActions` (Phase 1/2 + items 1‑4), `preventiveMeasures` (items 5‑7), `conclusion`,
     `timelineEvents` (7 lignes), `accessLogs` (table ci-dessus), `personalDataImpacted: true`,
     `specialCategoryData: true`, `affectedPersonsCount: 4`, `affectedPatientsCount: 1`.
   - `issuerSignature: { name: "Gilles Bertrand", role: "Gérant", org: "Triptyk SRL", date: "2026-04-03" }`,
     `recipientSignature: { name: "Patrick Burgeon", role: "Administrateur chargé de la gestion
     journalière", org: "OCM", date: "2026-04-03" }`.
2. Conserver le premier incident (IPBW / février) tel quel comme second exemple du registre.
3. Aligner les mocks front si nécessaire :
   `@libs/incident-registry-front/src/http-mocks/incidents.ts`.

### Phase 4 — Validation visuelle
1. Générer le PDF de l'incident OCM seedé et le comparer page à page au document de référence.
2. Ajuster espacements, largeurs de colonnes, sauts de page jusqu'à obtenir un rendu fidèle.

## 4. Stratégie de test

- **Unitaire (backend)** : `buildIncidentPdf(incident)` renvoie un `Buffer` PDF non vide et démarrant
  par `%PDF` ; total des accès correctement calculé (helper d'agrégation testé séparément :
  `11 accès / 4 utilisateurs`).
- **Unitaire (sérialiseur)** : `jsonApiSerializeIncident` accepte les nouvelles formes structurées de
  `descriptionSections` / `impactDetails` / signatures et reste rétro-compatible avec l'ancien `{name,date}`.
- **Intégrité** *(bloquant)* : la route `verify-integrity` reste verte après reseed (la chaîne de hash
  doit rester cohérente). Test d'intégration existant à faire repasser.
- **E2E** *(bloquant si présent)* : `@apps/e2e/tests/incidents.spec.ts` et `incidents-create.spec.ts`
  doivent toujours passer après l'adaptation du modèle (et l'éventuel export PDF).
- **Validation manuelle** : comparaison visuelle du PDF généré au PDF de référence (ne remplace pas les
  tests ci-dessus).

## 5. Critères de succès (vérifiables)

1. `export-incident-pdf.ts` produit un PDF dont la structure suit l'ordre §en-tête → §1 … §10 → annexe →
   signatures, avec titres numérotés `1. … 10.` (et non `§1`).
2. Plus aucun `JSON.stringify` n'apparaît dans le rendu (sous-sections, plan de communication et
   signatures rendus en texte/tables lisibles).
3. La chronologie (§5) et l'annexe des accès (§9) sont rendues comme **tables** avec en-tête bleu, et §9
   affiche la ligne « Total : 11 accès par 4 utilisateurs distincts ».
4. Le bloc signatures (§10) est rendu en **deux colonnes** Émetteur/Destinataire avec les champs
   Nom/Fonction/Société‑Organisation/Date/Signature.
5. Mention `CONFIDENTIEL` en en-tête et pied de page conforme
   `Triptyk SRL — Rapport d'incident {ref} — Version {version} — {reportDate} | Page N` sur chaque page.
6. Le seeder crée l'incident `INC-2026-0403-OCM` fidèle au rapport (4 utilisateurs IMAJE, 1 patient,
   11 accès, signatures Bertrand/Burgeon).
7. Types `descriptionSections` / `impactDetails` / signatures resserrés et cohérents entre entité,
   sérialiseur Zod et schéma front ; build TypeScript vert.
8. `pnpm lint`, `pnpm build` et la suite de tests (unitaires + intégration intégrité + E2E incidents)
   passent au vert.

## 6. Hors périmètre / à confirmer

- Aucune migration SQL ni modification de la nature append-only de la table `incident`.
- Écart de comptage logs brut (12) vs rapport (11) : **aligné sur le rapport** ; à confirmer.
- Le PDF du **registre** (`export-registry-pdf.ts`, la liste globale) est déjà soigné et **n'est pas**
  l'objet de ce plan, sauf demande contraire.
