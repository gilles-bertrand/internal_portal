# Divergences de contrat front/back — incident-registry

Plusieurs écarts entre la validation Zod front et le schéma Zod backend d'incident-registry sont des incohérences de données réelles, pas de simples divergences de style — à corriger ou au moins tracer avant de s'y fier.

## Sections de description : mapping aligné sur `body`

**Écart fermé.** Le brouillon front reste `{title, detail}` pour l'édition, mais [[@libs/incident-registry-front/src/components/forms/incident-payload.ts#canonicalDescriptionSection]] émet désormais `{title, body}` — le nom canonique du backend.

Le `.passthrough()` du schéma backend acceptait silencieusement `detail` : le contenu était bien **persisté** mais n'apparaissait ni dans la fiche détail (`incident-detail-parts.gts` (`DescriptionBlocks`) lit `block.body`) ni dans le rapport PDF ([[incident-registry#Export PDF à 10 sections]]). Une perte de contenu invisible dans un registre RGPD : l'utilisateur saisissait un corps de section qui ne ressortait nulle part.

`incidentToDraft` relit `detail ?? body`, donc l'édition des enregistrements historiques écrits avec `detail` reste correcte.

### Les enregistrements déjà écrits doivent rester lisibles

Corriger l'écriture ne répare pas les lignes déjà écrites : la table incident est append-only et protégée par trigger, donc aucun UPDATE ne peut les rattraper.

Les deux surfaces de LECTURE replient donc `body ?? detail` — `IncidentDetail#descriptionBlocks` pour la fiche, et le type `DescriptionSection` de [[@libs/incident-registry-backend/src/utils/export-incident-pdf.ts#buildIncidentPdf]] pour le rapport officiel. Sans ce repli, le corps de section de ces incidents restait invisible pour toujours, y compris dans l'export remis à une autorité de contrôle.

`detail` n'est PAS un champ du contrat : c'est un nom accepté par accident, et ce repli est une compatibilité de lecture, pas une seconde forme canonique.

### `items` survit à un aller-retour d'édition

Un bloc de description peut porter une liste à puces (`items`), déclarée par le schéma backend et rendue par le PDF, mais qu'aucun écran n'édite.

Le chemin d'édition la perdait deux fois : `incidentToDraft` ne recopiait que `{title, detail}`, puis le mapping de soumission ne réémettait que `{title, body}`. Éditer un incident créé par API écrivait donc une nouvelle version amputée de ses listes — définitivement, la version précédente étant immuable mais supplantée. Les deux projections recopient désormais `items`.

## Validation art. 9 alignée sur le backend

**Écart fermé.** [[@libs/incident-registry-front/src/components/forms/incident-validation.ts#refineArt9Impact]] reproduit désormais exactement les trois règles art. 9 du backend, champ par champ, sur l'étape 4.

Le front n'exigeait qu'`impactSummary` non vide OU un compteur non nul — règle morte, puisque `impactSummary` est de toute façon obligatoire. Le backend exige en réalité `severityOverall` **et** `severityCompliance`, PLUS au moins un compteur d'affectés non nul ([[incident-registry#Validation métier à la création]]). Le wizard laissait donc passer les huit étapes, l'API répondait 400 `MISSING_IMPACT_FIELDS` sur un champ de l'étape 4, et ce champ n'étant pas rendu depuis l'étape 8 l'utilisateur ne voyait **rien**.

Le compteur est testé `== null` comme côté backend : un compteur à `0` est une valeur légitime (« aucun patient concerné »), on ne l'exige pas strictement positif.

## Autres écarts mineurs

~~Le front ne valide jamais `incidentEndAt >= incidentStartAt`~~ — **écart fermé** : `refineIncidentDates` contrôle désormais les deux règles de cohérence de dates côté front, avant l'aller-retour API qui renvoyait 400 `INCOHERENT_DATES` (voir [[incident-registry-wizard#Règles inter-champs partagées]]).

### completedAt : date saisie, datetime attendu

**Écart fermé.** `correctiveActions.completedAt` est saisi comme une DATE (`<input type="date">` → `2026-08-20`) mais déclaré `string().datetime()` côté backend.

C'était le dernier 400 qui bloquait toute création depuis l'UI (« Invalid ISO datetime »). `normalizePayload` projette le jour saisi sur son minuit UTC : le contrat est respecté sans demander à l'utilisateur une heure qu'il n'a pas. Un champ vide reste `undefined` — le backend le déclare optionnel, et inventer une date serait une donnée fausse dans un registre.

Le formulaire (`@libs/incident-registry-front/src/components/forms/incident-form.gts`, composant `IncidentForm`) limite les signatures à `{name, date}` alors que le modèle et le PDF prévoient aussi `role`/`org` (affichés "—" si absents) — perte fonctionnelle plutôt que bug, les champs existent mais ne sont pas exposés dans l'UI actuelle.
