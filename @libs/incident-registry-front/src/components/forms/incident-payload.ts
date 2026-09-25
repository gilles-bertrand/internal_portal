import type { ValidatedIncident } from '#src/components/forms/incident-validation.ts';

// Coercitions du payload incident, extraites de `incident-form.gts` pour être
// testables sans rendre le wizard — même raison que `incident-step-errors.ts`.
//
// POURQUOI CE MODULE EXISTE, ET NON LE SCHÉMA ZOD.
//
// `TpkForm.validateAndSubmit` appelle `onSubmit(this.args.changeset.data, …)`
// — la donnée BRUTE du changeset — après avoir seulement *validé* contre le
// schéma. Les `z.coerce`, `z.preprocess` et `.transform()` du schéma
// n'atteignent donc JAMAIS le payload envoyé à l'API : la signature
// `onSubmit(data: ValidatedIncident)` est un mensonge au runtime.
//
// Conséquence observée : un `<input>` texte remonte toujours une chaîne, donc
// `resolutionDurationMinutes` partait en `"240"` et le backend répondait 400
// « expected number, received string » sur un champ de l'étape 2 — invisible
// depuis l'étape 8, donc « enregistrer » ne faisait visiblement rien.
//
// Toute nouvelle coercition du schéma doit être répliquée ici, ET couverte par
// `tests/unit/incident-payload-test.ts` : c'est ce test qui remplace le
// « pensez-y » que ce commentaire ne peut pas garantir.

/**
 * Entier, ou `null` si le champ est vide / non numérique.
 *
 * Un champ laissé vide vaut « non déterminé », jamais 0 : dans un registre
 * RGPD, « 0 personne concernée » est une affirmation, pas une absence de
 * réponse.
 */
export function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/**
 * Jour (`2026-08-20`) → datetime ISO à minuit UTC, forme exigée par les champs
 * `string().datetime()` du backend.
 *
 * `undefined` reste `undefined` : le champ est optionnel côté backend, et
 * envoyer une date bidon serait une donnée fausse dans un registre RGPD.
 */
export function dayToIsoDatetime(
  value: string | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value
  );
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * `setDateField` stocke un `Date` (exigé par tempus-dominus) ; le backend
 * attend une chaîne ISO. `null` pour un champ date vide.
 */
export function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  // Tout le reste est déjà une chaîne ISO venant du changeset ; un objet
  // inattendu serait stringifié en « [object Object] » et refusé par le
  // backend, donc on le neutralise en null plutôt que d'envoyer du bruit.
  return typeof value === 'string' ? value : null;
}

// Forme d'un bloc de description tel qu'il transite dans le changeset : le
// brouillon front nomme le corps `detail`, le backend le nomme `body`, et
// `items` n'est éditable par aucun écran mais existe sur les enregistrements
// créés par API ou par seed.
type DraftSection = {
  title: string;
  detail?: string;
  body?: string;
  items?: string[];
};

/**
 * Projette un bloc de description sur le nom canonique du backend.
 *
 * Le champ canonique est `body` : c'est le nom déclaré par le schéma backend,
 * celui que lit la vue détail et celui que rend le PDF. Le formulaire envoyait
 * `detail`, que le `.passthrough()` du backend acceptait silencieusement — le
 * contenu était bien PERSISTÉ mais ne ressortait ni dans la fiche ni dans le
 * rapport.
 *
 * `items` est recopié tel quel : un bloc à puces créé par API survit à un
 * aller-retour d'édition. Sans cette recopie, éditer l'incident écrivait une
 * nouvelle version amputée de ses listes, définitivement (la table est
 * append-only, la version précédente est immuable mais supplantée).
 */
export function canonicalDescriptionSection(section: DraftSection): {
  title: string;
  body?: string;
  items?: string[];
} {
  const body = section.detail ?? section.body;
  return {
    title: section.title,
    ...(body === undefined ? {} : { body }),
    ...(section.items === undefined ? {} : { items: section.items }),
  };
}

/**
 * Applique à la donnée brute du changeset toutes les conversions que le schéma
 * Zod décrit mais n'exécute pas sur le chemin de soumission.
 */
export function normalizeIncidentPayload(
  data: ValidatedIncident
): ValidatedIncident {
  const raw = data as unknown as Record<string, unknown>;
  const sections = data.descriptionSections as DraftSection[] | undefined;

  return {
    ...data,
    reportDate: toIso(raw['reportDate']) ?? data.reportDate,
    incidentStartAt: toIso(raw['incidentStartAt']) ?? data.incidentStartAt,
    detectedAt: toIso(raw['detectedAt']) ?? data.detectedAt,
    incidentEndAt: toIso(raw['incidentEndAt']),
    resolvedAt: toIso(raw['resolvedAt']),
    resolutionDurationMinutes: toIntOrNull(raw['resolutionDurationMinutes']),
    technicalLeadId: data.technicalLeadId || null,
    apdNotificationRequired: data.apdNotificationRequired ?? null,
    severityOperational: data.severityOperational || null,
    severityCompliance: data.severityCompliance || null,
    severityOverall: data.severityOverall || null,
    affectedPersonsCount: toIntOrNull(raw['affectedPersonsCount']),
    affectedPatientsCount: toIntOrNull(raw['affectedPatientsCount']),
    descriptionSections: sections?.length
      ? (sections.map(
          canonicalDescriptionSection
        ) as unknown as ValidatedIncident['descriptionSections'])
      : undefined,
    communicationPlan: data.communicationPlan?.length
      ? data.communicationPlan
      : undefined,
    accessLogs: data.accessLogs?.length
      ? data.accessLogs.map((log) => ({
          ...log,
          count: toIntOrNull(log.count) ?? 0,
        }))
      : null,
    contributingFactors: data.contributingFactors ?? [],
    // `completedAt` est saisi comme une DATE (`<input type="date">` →
    // `2026-08-20`) alors que le backend le déclare `string().datetime()` : il
    // répondait 400 « Invalid ISO datetime » et l'incident n'était jamais créé.
    // On projette le jour saisi sur son minuit UTC pour respecter le contrat
    // sans demander à l'utilisateur une heure qu'il n'a pas.
    correctiveActions: (data.correctiveActions ?? []).map((action) => ({
      ...action,
      order: toIntOrNull(action.order) ?? 0,
      completedAt: dayToIsoDatetime(action.completedAt),
    })),
    preventiveMeasures: data.preventiveMeasures ?? [],
    timelineEvents: data.timelineEvents ?? [],
  };
}
