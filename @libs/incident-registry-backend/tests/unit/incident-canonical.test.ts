import { describe, expect, test } from "vitest";
import { computeRecordHash, GENESIS_HASH } from "@libs/backend-shared";
import { IncidentEntity } from "#src/entities/incident.entity.js";
import {
  CURRENT_INCIDENT_CANONICAL_VERSION,
  INCIDENT_CANONICAL_VERSIONS,
  NON_CANONICAL_INCIDENT_FIELDS,
  canonicalVersionOf,
  incidentCanonicalProjection,
  incidentCanonicalString,
} from "#src/utils/incident-canonical.js";
import { verifyIncidentChain } from "#src/utils/integrity.js";
import { frozenIncidentRowAt } from "#tests/unit/canonical-fixtures.js";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";

function sortedFields(version: number): string {
  return [...INCIDENT_CANONICAL_VERSIONS[version]!].sort().join(",");
}

/** Chaîne une ligne sur un prevHash donné et calcule son hash réel. */
function link(
  row: Omit<IncidentEntityType, "hash">,
  prevHash: string,
  seq: number,
): IncidentEntityType {
  const chained = { ...row, prevHash, seq };
  const canonical = incidentCanonicalString(chained, canonicalVersionOf(chained));
  return { ...chained, hash: computeRecordHash(prevHash, canonical) };
}

// @lat: [[backend/hash-chain-integrity#Jeu de champs canoniques versionné#Versions figées par un hash de référence]]
describe("versions figées", () => {
  test("la v1 est exactement le jeu de champs haché avant le versionnage", () => {
    // Si cette assertion casse, une version DÉPLOYÉE a été modifiée : les hashs
    // des lignes existantes ne sont plus reproductibles et aucune migration
    // n'est possible (triggers append-only). Ouvrir une nouvelle version.
    expect(sortedFields(1)).toBe(
      "accessLogs,affectedPatientsCount,affectedPersonsCount,apdNotificationRequired,applicationDetail,applicationName,classification,clientCode,clientName,communicationPlan,conclusion,contributingFactors,correctiveActions,deployedVersion,description,descriptionSections,detectedAt,encodedAt,encodedBy,environment,id,immediateCause,impactDetails,impactSummary,incidentEndAt,incidentStartAt,issuerSignature,legalContext,personalDataImpacted,preventiveMeasures,recipientName,recipientOrg,recipientSignature,reference,reportDate,reportedBy,resolutionDurationMinutes,resolvedAt,seq,serviceName,severityCompliance,severityOperational,severityOverall,specialCategoryData,status,technicalLeadId,timelineEvents,version",
    );
  });

  test("hash de référence v1 — verrouille la chaîne canonique des lignes existantes", () => {
    const row = frozenIncidentRowAt(1);
    const hash = computeRecordHash(GENESIS_HASH, incidentCanonicalString(row, 1));
    expect(hash).toBe("ead6331a74f619352cd254d38837dfef084f2647e804d8aa904ce5ecb00148da");
  });

  test("hash de référence v2", () => {
    const row = frozenIncidentRowAt(2);
    const hash = computeRecordHash(GENESIS_HASH, incidentCanonicalString(row, 2));
    expect(hash).toBe("12e6c2e222b2133cf1c287098e21f221e70909c1bdad0f79f69ef30ba473b3a4");
  });

  test("la v1 ignore canonicalVersion, la v2 l'inclut", () => {
    // Raison d'être du numéro DANS le jeu canonique : le hash prouve sous quelle
    // liste la ligne a été écrite, au lieu de croire la colonne telle que lue.
    expect(incidentCanonicalString(frozenIncidentRowAt(1), 1)).not.toContain("canonicalVersion");
    expect(incidentCanonicalString(frozenIncidentRowAt(2), 2)).toContain('"canonicalVersion":2');
  });

  test("v2 = v1 + canonicalVersion, rien d'autre", () => {
    const added = INCIDENT_CANONICAL_VERSIONS[2]!.filter(
      (f) => !INCIDENT_CANONICAL_VERSIONS[1]!.includes(f),
    );
    expect(added).toEqual(["canonicalVersion"]);
  });

  test("une version inconnue échoue bruyamment (fail-closed)", () => {
    // Une ligne portant une version que ce code ne connaît pas ne doit jamais
    // être déclarée intègre par défaut.
    expect(() => incidentCanonicalProjection(frozenIncidentRowAt(1), 99)).toThrow(
      /canonical version inconnue: 99/,
    );
  });
});

// @lat: [[backend/hash-chain-integrity#Jeu de champs canoniques versionné#Test d'exhaustivité sur les colonnes de l'entité]]
describe("exhaustivité vis-à-vis de l'entité", () => {
  test("toute colonne est soit canonique en version courante, soit explicitement non canonique", () => {
    // C'EST le garde-fou des tickets CNIL : ajouter une colonne à l'entité sans
    // décider de son statut casse ce test, au lieu de casser silencieusement la
    // vérification d'intégrité des nouvelles lignes.
    const entityFields = Object.keys(IncidentEntity.properties).sort();
    const declared = [
      ...INCIDENT_CANONICAL_VERSIONS[CURRENT_INCIDENT_CANONICAL_VERSION]!,
      ...NON_CANONICAL_INCIDENT_FIELDS,
    ].sort();
    expect(declared).toEqual(entityFields);
  });

  test("les colonnes lifecycle mutables ne sont jamais canoniques", () => {
    // Elles changent légitimement après l'écriture (édition, soft-delete) : les
    // hacher ferait passer toute opération de cycle de vie pour une falsification.
    for (const field of [
      "revision",
      "supersededById",
      "updatedBy",
      "updatedAt",
      "deletedAt",
      "deletedBy",
    ]) {
      for (const version of Object.keys(INCIDENT_CANONICAL_VERSIONS)) {
        expect(INCIDENT_CANONICAL_VERSIONS[Number(version)]).not.toContain(field);
      }
    }
  });

  test("canonicalVersion n'est pas traitée comme du lifecycle", () => {
    expect(NON_CANONICAL_INCIDENT_FIELDS).not.toContain("canonicalVersion");
  });
});

// @lat: [[backend/hash-chain-integrity#Jeu de champs canoniques versionné#Chaîne mixte v1 + v2]]
describe("chaîne mixte", () => {
  function mixedChain(): IncidentEntityType[] {
    const v1 = link(frozenIncidentRowAt(1), GENESIS_HASH, 1);
    const v2 = link(
      { ...frozenIncidentRowAt(2), id: "22222222-2222-2222-2222-222222222222" },
      v1.hash,
      2,
    );
    const v2bis = link(
      { ...frozenIncidentRowAt(2), id: "33333333-3333-3333-3333-333333333333" },
      v2.hash,
      3,
    );
    return [v1, v2, v2bis];
  }

  test("une chaîne v1 puis v2 se vérifie sans re-hachage", () => {
    expect(verifyIncidentChain(mixedChain())).toEqual({ ok: true, total: 3 });
  });

  test("falsifier un champ v1 casse la chaîne au bon maillon", () => {
    const chain = mixedChain();
    chain[0] = { ...chain[0]!, description: "falsifié" };
    expect(verifyIncidentChain(chain)).toMatchObject({ ok: false, brokenAt: 0 });
  });

  test("falsifier un champ v2-only (canonicalVersion) casse la chaîne", () => {
    // Rétrograder une ligne v2 en v1 la ferait vérifier sous une autre liste :
    // détecté, parce que le numéro de version est lui-même haché.
    const chain = mixedChain();
    chain[1] = { ...chain[1]!, canonicalVersion: 1 };
    expect(verifyIncidentChain(chain)).toMatchObject({ ok: false, brokenAt: 1 });
  });

  test("falsifier un champ de contenu d'une ligne v2 casse la chaîne", () => {
    const chain = mixedChain();
    chain[2] = { ...chain[2]!, immediateCause: "falsifié" };
    expect(verifyIncidentChain(chain)).toMatchObject({ ok: false, brokenAt: 2 });
  });

  test("muter une colonne lifecycle ne casse PAS la chaîne", () => {
    // Contrepartie indispensable : l'édition (nouvelle version) et le
    // soft-delete posent ces colonnes sur des lignes déjà chaînées.
    const chain = mixedChain();
    chain[0] = {
      ...chain[0]!,
      supersededById: chain[1]!.id,
      deletedAt: "2026-02-01T00:00:00.000Z",
    };
    expect(verifyIncidentChain(chain)).toEqual({ ok: true, total: 3 });
  });
});
