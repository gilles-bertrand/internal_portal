# Divergences de contrat front/back — incident-registry

Plusieurs écarts entre la validation Zod front et le schéma Zod backend d'incident-registry sont des incohérences de données réelles, pas de simples divergences de style — à corriger ou au moins tracer avant de s'y fier.

## Sections de description : mapping cassé

Le front modélise chaque section de description comme `{title, detail}`, alors que l'entité et le schéma backend attendent `{title, body?, items?}`.

Composant concerné : `@libs/incident-registry-front/src/components/forms/incident-description-sections-editor.gts` (`IncidentDescriptionSectionsEditor`).

Le champ `detail` saisi par l'utilisateur n'est donc jamais mappé vers `body`. Au rendu PDF ([[incident-registry#Export PDF à 10 sections]]), le corps de toute section créée via le formulaire actuel reste vide alors que le titre s'affiche. À corriger en priorité : soit aligner le champ front sur `body`, soit faire évoluer le contrat backend.

## Validation art. 9 plus permissive côté front

Le front ([[@libs/incident-registry-front/src/components/forms/incident-validation.ts#createIncidentValidationSchema]]) exige seulement `impactSummary` non vide OU un des deux compteurs d'affectés non nul quand `specialCategoryData=true`.

Le backend exige en réalité `severityOverall` **et** `severityCompliance` renseignés en plus d'un compteur non nul ([[incident-registry#Validation métier à la création]]). Un utilisateur peut donc passer la validation front puis se voir rejeté en 400 `MISSING_IMPACT_FIELDS` au submit, sans jamais avoir vu de contrôle sur `severityOverall`/`severityCompliance` dans ce cas.

## Autres écarts mineurs

Le front ne valide jamais `incidentEndAt >= incidentStartAt` (seul `resolvedAt >= detectedAt` l'est), alors que le backend renvoie 400 `INCOHERENT_DATES` sur cette règle.

`correctiveActions.completedAt` est une simple chaîne libre côté front mais un `datetime()` ISO strict côté backend — une date non-ISO saisie au front sera rejetée à l'API.

Le formulaire (`@libs/incident-registry-front/src/components/forms/incident-form.gts`, composant `IncidentForm`) limite les signatures à `{name, date}` alors que le modèle et le PDF prévoient aussi `role`/`org` (affichés "—" si absents) — perte fonctionnelle plutôt que bug, les champs existent mais ne sont pas exposés dans l'UI actuelle.
