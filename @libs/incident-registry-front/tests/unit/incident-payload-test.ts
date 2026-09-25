import { describe, it, expect as hardExpect } from 'vitest';
import {
  canonicalDescriptionSection,
  dayToIsoDatetime,
  normalizeIncidentPayload,
  toIntOrNull,
  toIso,
} from '#src/components/forms/incident-payload.ts';
import type { ValidatedIncident } from '#src/components/forms/incident-validation.ts';

const expect = hardExpect.soft;

// Ce fichier est le garde-fou de `incident-payload.ts`. Le schéma Zod DÉCRIT
// des coercitions que `TpkForm` n'exécute jamais sur le chemin de soumission
// (il soumet la donnée brute du changeset), donc ce module les rejoue à la
// main. Chaque cas ci-dessous correspond à un 400 réellement observé, ou à une
// perte de contenu réellement constatée : les laisser sans test, c'est laisser
// revenir des bugs qui bloquent toute création d'incident.

// Brouillon minimal, avec les valeurs telles que le CHANGESET les porte : des
// `Date` pour les champs datepicker, des chaînes pour les `<input>` texte.
function draft(overrides: Record<string, unknown> = {}): ValidatedIncident {
  return {
    reportDate: new Date('2026-04-03T09:00:00.000Z'),
    incidentStartAt: new Date('2026-04-02T07:58:00.000Z'),
    detectedAt: new Date('2026-04-03T09:13:00.000Z'),
    incidentEndAt: null,
    resolvedAt: null,
    resolutionDurationMinutes: '',
    affectedPersonsCount: '',
    affectedPatientsCount: '',
    technicalLeadId: '',
    severityOperational: '',
    severityCompliance: '',
    severityOverall: '',
    apdNotificationRequired: undefined,
    descriptionSections: [],
    communicationPlan: [],
    accessLogs: [],
    correctiveActions: [],
    contributingFactors: undefined,
    preventiveMeasures: undefined,
    timelineEvents: undefined,
    ...overrides,
  } as unknown as ValidatedIncident;
}

describe('toIntOrNull', () => {
  // Le compteur part d'un <input> texte : il remonte TOUJOURS une chaîne, et le
  // backend répondait 400 « expected number, received string ».
  it('convertit la chaîne d’un <input> en entier', () => {
    expect(toIntOrNull('240')).toBe(240);
    expect(toIntOrNull('12.7')).toBe(12);
  });

  // RGPD : un compteur vide vaut « non déterminé », jamais 0. `Number(null)`
  // et `Number('')` valent tous deux 0 — affirmer « 0 personne concernée »
  // dans un registre de violations est un fait faux, pas une absence de
  // réponse.
  it('rend null — et surtout pas 0 — pour un champ vide', () => {
    expect(toIntOrNull('')).toBeNull();
    expect(toIntOrNull(null)).toBeNull();
    expect(toIntOrNull(undefined)).toBeNull();
  });

  it('neutralise une saisie non numérique plutôt que d’envoyer NaN', () => {
    expect(toIntOrNull('quatre')).toBeNull();
  });

  it('préserve un zéro explicitement saisi', () => {
    expect(toIntOrNull('0')).toBe(0);
    expect(toIntOrNull(0)).toBe(0);
  });
});

describe('toIso', () => {
  // `setDateField` stocke un Date (exigé par tempus-dominus), le backend
  // attend une chaîne ISO.
  it('sérialise le Date du datepicker', () => {
    expect(toIso(new Date('2026-04-03T09:00:00.000Z'))).toBe(
      '2026-04-03T09:00:00.000Z'
    );
  });

  it('laisse passer une chaîne ISO déjà formée', () => {
    expect(toIso('2026-04-03T09:00:00.000Z')).toBe('2026-04-03T09:00:00.000Z');
  });

  it('rend null pour un champ date vide', () => {
    expect(toIso('')).toBeNull();
    expect(toIso(null)).toBeNull();
  });

  // Un objet inattendu serait stringifié en « [object Object] » et refusé par
  // le backend : on préfère un null explicite à du bruit.
  it('neutralise une valeur inattendue et une date invalide', () => {
    expect(toIso({ nope: true })).toBeNull();
    expect(toIso(new Date('pas une date'))).toBeNull();
  });
});

describe('dayToIsoDatetime', () => {
  // `completedAt` est saisi par <input type="date"> (`2026-08-20`) alors que le
  // backend le déclare `string().datetime()`. C'était le dernier 400 qui
  // bloquait toute création depuis l'UI.
  it('projette un jour saisi sur son minuit UTC', () => {
    expect(dayToIsoDatetime('2026-08-20')).toBe('2026-08-20T00:00:00.000Z');
  });

  // Inventer une date pour un champ optionnel serait une donnée fausse dans un
  // registre : l'absence doit rester une absence.
  it('laisse undefined un champ vide plutôt que d’inventer une date', () => {
    expect(dayToIsoDatetime(undefined)).toBeUndefined();
    expect(dayToIsoDatetime('')).toBeUndefined();
    expect(dayToIsoDatetime('pas une date')).toBeUndefined();
  });
});

describe('canonicalDescriptionSection', () => {
  // Le champ canonique du backend est `body`. Le formulaire envoyait `detail`,
  // accepté en silence par le `.passthrough()` : le contenu était PERSISTÉ
  // mais n'apparaissait ni dans la fiche ni dans le PDF.
  it('projette `detail` sur le nom canonique `body`', () => {
    expect(
      canonicalDescriptionSection({ title: 'T', detail: 'corps' })
    ).toEqual({ title: 'T', body: 'corps' });
  });

  it('laisse `body` intact quand il est déjà canonique', () => {
    expect(canonicalDescriptionSection({ title: 'T', body: 'corps' })).toEqual({
      title: 'T',
      body: 'corps',
    });
  });

  // Régression de perte de données : `items` n'est éditable par aucun écran,
  // donc un mapping qui ne recopie que {title, body} amputait de ses listes
  // tout bloc créé par API — définitivement, la table étant append-only.
  it('préserve les listes à puces qu’aucun écran n’édite', () => {
    expect(
      canonicalDescriptionSection({
        title: 'T',
        detail: 'corps',
        items: ['a', 'b'],
      })
    ).toEqual({ title: 'T', body: 'corps', items: ['a', 'b'] });
  });

  it('n’invente pas de clé `body` pour un bloc sans corps', () => {
    expect(canonicalDescriptionSection({ title: 'T' })).toEqual({ title: 'T' });
  });
});

describe('normalizeIncidentPayload', () => {
  it('sérialise les cinq champs de date du wizard', () => {
    const payload = normalizeIncidentPayload(
      draft({
        incidentEndAt: new Date('2026-04-03T09:47:00.000Z'),
        resolvedAt: new Date('2026-04-03T09:47:00.000Z'),
      })
    );

    expect(payload.reportDate).toBe('2026-04-03T09:00:00.000Z');
    expect(payload.incidentStartAt).toBe('2026-04-02T07:58:00.000Z');
    expect(payload.detectedAt).toBe('2026-04-03T09:13:00.000Z');
    expect(payload.incidentEndAt).toBe('2026-04-03T09:47:00.000Z');
    expect(payload.resolvedAt).toBe('2026-04-03T09:47:00.000Z');
  });

  it('convertit les compteurs saisis et laisse null ceux qui sont vides', () => {
    const payload = normalizeIncidentPayload(
      draft({ resolutionDurationMinutes: '34', affectedPersonsCount: '4' })
    );

    expect(payload.resolutionDurationMinutes).toBe(34);
    expect(payload.affectedPersonsCount).toBe(4);
    expect(payload.affectedPatientsCount).toBeNull();
  });

  it('émet des blocs de description au nom canonique du backend', () => {
    const payload = normalizeIncidentPayload(
      draft({
        descriptionSections: [
          { title: 'Contexte', detail: 'Feuillets visibles', items: ['x'] },
        ],
      })
    );

    expect(payload.descriptionSections).toEqual([
      { title: 'Contexte', body: 'Feuillets visibles', items: ['x'] },
    ]);
  });

  it('projette `completedAt` sur un datetime et normalise `order`', () => {
    const payload = normalizeIncidentPayload(
      draft({
        correctiveActions: [
          {
            phase: 'Phase 1',
            order: '1',
            title: 'Détection',
            detail: 'Incident détecté',
            completedAt: '2026-08-20',
          },
        ],
      })
    );

    expect(payload.correctiveActions?.[0]?.order).toBe(1);
    expect(payload.correctiveActions?.[0]?.completedAt).toBe(
      '2026-08-20T00:00:00.000Z'
    );
  });

  it('normalise le compteur d’accès de chaque ligne du journal', () => {
    const payload = normalizeIncidentPayload(
      draft({
        accessLogs: [
          {
            date: '2026-04-02',
            user: 'A',
            email: 'a@b.c',
            files: 'F',
            count: '5',
          },
        ],
      })
    );

    expect(payload.accessLogs?.[0]?.count).toBe(5);
  });

  // Un tableau vide et une chaîne vide ne veulent pas dire la même chose que
  // « champ absent » pour le backend : les collections vides partent en
  // undefined/null, les chaînes vides en null.
  it('ramène les collections vides et les chaînes vides à l’absence', () => {
    const payload = normalizeIncidentPayload(draft());

    expect(payload.descriptionSections).toBeUndefined();
    expect(payload.communicationPlan).toBeUndefined();
    expect(payload.accessLogs).toBeNull();
    expect(payload.technicalLeadId).toBeNull();
    expect(payload.severityOverall).toBeNull();
    expect(payload.apdNotificationRequired).toBeNull();
  });

  it('remplace par un tableau vide les listes que le backend exige présentes', () => {
    const payload = normalizeIncidentPayload(draft());

    expect(payload.contributingFactors).toEqual([]);
    expect(payload.preventiveMeasures).toEqual([]);
    expect(payload.timelineEvents).toEqual([]);
    expect(payload.correctiveActions).toEqual([]);
  });

  // Le payload part à l'API : aucune valeur ne doit y arriver sous une forme
  // que le backend refuse. Ce test échouera si une coercition est ajoutée au
  // schéma Zod sans être rejouée ici — c'est son seul but.
  it('ne laisse aucun Date résiduel dans le payload', () => {
    const payload = normalizeIncidentPayload(
      draft({ incidentEndAt: new Date('2026-04-03T09:47:00.000Z') })
    );

    for (const [key, value] of Object.entries(payload)) {
      expect(`${key}:${value instanceof Date}`).toBe(`${key}:false`);
    }
  });
});
