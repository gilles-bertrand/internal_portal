import { verifyChain } from "@libs/backend-shared";
import { canonicalVersionOf, incidentCanonicalString } from "#src/utils/incident-canonical.js";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";

export interface IntegrityCheckResult {
  ok: boolean;
  total: number;
  brokenAt?: number;
  reason?: string;
}

/**
 * Rejoue la chaîne d'incidents. Chaque ligne est vérifiée avec le jeu de champs
 * canoniques EN VIGUEUR AU MOMENT DE SON ÉCRITURE, lu sur la ligne elle-même :
 * une chaîne mixte (lignes v1 antérieures au versionnage + lignes v2) se
 * vérifie donc sans re-hachage, ce que les triggers append-only interdisent de
 * toute façon.
 *
 * `records` DOIT être la chaîne complète, triée par `seq` croissant : un
 * sous-ensemble filtré n'est pas une chaîne (le premier maillon ne référencerait
 * pas GENESIS_HASH). Voir lat.md/backend/hash-chain-integrity.md.
 *
 * @lat: [[backend/hash-chain-integrity#Jeu de champs canoniques versionné]]
 */
export function verifyIncidentChain(records: IncidentEntityType[]): IntegrityCheckResult {
  const links = records.map((record) => ({
    hash: record.hash,
    prevHash: record.prevHash,
    canonical: incidentCanonicalString(record, canonicalVersionOf(record)),
  }));

  const broken = verifyChain(links);
  if (broken) {
    return { ok: false, total: records.length, ...broken };
  }
  return { ok: true, total: records.length };
}
