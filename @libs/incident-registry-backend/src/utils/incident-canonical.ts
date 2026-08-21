import {
  canonicalSerialize,
  pickCanonicalFields,
  resolveCanonicalFieldSet,
  type CanonicalFieldSetRegistry,
} from "@libs/backend-shared";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";

/** Tout nom de colonne de l'entité Incident. Interdit les fautes de frappe. */
type IncidentField = keyof IncidentEntityType & string;

/**
 * Colonnes explicitement HORS chaîne de hash, à toutes les versions.
 *
 * - `hash`/`prevHash` : le chaînage lui-même (déjà exclus par canonicalSerialize).
 * - les 6 colonnes lifecycle : elles changent légitimement APRÈS l'écriture
 *   (versioning + soft-delete), donc les inclure rendrait toute édition ou
 *   suppression logique « falsification ». Ce sont exactement les colonnes
 *   autorisées par le trigger `incident_no_mutation`.
 *
 * `canonicalVersion` n'est PAS ici : elle ne change jamais après l'écriture,
 * c'est donc du contenu, pas du lifecycle.
 */
export const NON_CANONICAL_INCIDENT_FIELDS = [
  "hash",
  "prevHash",
  "revision",
  "supersededById",
  "updatedBy",
  "updatedAt",
  "deletedAt",
  "deletedBy",
] as const satisfies readonly IncidentField[];

/**
 * VERSION 1 — FIGÉE. Jeu de champs des lignes écrites avant l'introduction du
 * versionnage. Ne contient PAS `canonicalVersion` : les lignes v1 ont été
 * hachées sans cette clé, l'ajouter invaliderait leurs hashs.
 *
 * NE JAMAIS MODIFIER. Verrouillée par le hash de référence de
 * `tests/unit/incident-canonical.test.ts`.
 */
const V1_FIELDS = [
  "id",
  "seq",
  "reference",
  "reportDate",
  "version",
  "classification",
  "status",
  "applicationName",
  "applicationDetail",
  "environment",
  "clientCode",
  "clientName",
  "reportedBy",
  "encodedBy",
  "encodedAt",
  "recipientName",
  "recipientOrg",
  "legalContext",
  "serviceName",
  "deployedVersion",
  "incidentStartAt",
  "incidentEndAt",
  "detectedAt",
  "resolvedAt",
  "resolutionDurationMinutes",
  "technicalLeadId",
  "description",
  "descriptionSections",
  "personalDataImpacted",
  "specialCategoryData",
  "apdNotificationRequired",
  "impactSummary",
  "impactDetails",
  "severityOperational",
  "severityCompliance",
  "severityOverall",
  "affectedPersonsCount",
  "affectedPatientsCount",
  "immediateCause",
  "contributingFactors",
  "correctiveActions",
  "preventiveMeasures",
  "communicationPlan",
  "conclusion",
  "timelineEvents",
  "accessLogs",
  "issuerSignature",
  "recipientSignature",
] as const satisfies readonly IncidentField[];

/**
 * VERSION 2 — version courante, ouverte tant qu'elle n'est pas déployée.
 *
 * v1 + `canonicalVersion`. C'est ici que les champs CNIL 1–9 s'ajoutent : une
 * seule ligne par champ, à la fin. Un ajout reste licite AUSSI LONGTEMPS
 * qu'aucune ligne v2 n'existe en production ; passé ce point il faut ouvrir une
 * v3 (voir `lat.md/backend/hash-chain-integrity.md`).
 *
 * L'ordre de déclaration n'a aucun effet : `canonicalSerialize` trie les clés.
 * Seul l'ENSEMBLE des clés compte.
 */
const V2_FIELDS = [...V1_FIELDS, "canonicalVersion"] as const satisfies readonly IncidentField[];

export const INCIDENT_CANONICAL_VERSIONS: CanonicalFieldSetRegistry<IncidentField> = {
  1: V1_FIELDS,
  2: V2_FIELDS,
};

/** Version estampillée sur toute nouvelle ligne par l'AppendService. */
export const CURRENT_INCIDENT_CANONICAL_VERSION = 2;

/**
 * Source acceptable pour une projection canonique : une ligne complète, ou la
 * ligne en cours de construction dans l'AppendService (le `hash` est le
 * résultat du calcul, il ne peut pas en être une entrée).
 */
export type IncidentCanonicalSource = Omit<IncidentEntityType, "hash">;

/**
 * Projette un incident sur son jeu de champs canoniques.
 *
 * UNIQUE source de vérité, utilisée par les DEUX chemins : l'écriture
 * (`AppendService`, qui hache) et la vérification (`verifyIncidentChain`, qui
 * recalcule). C'est ce partage qui empêche les deux listes de divergences
 * silencieuses — l'ancien code en avait deux, tenues synchronisées à la main.
 */
export function incidentCanonicalProjection(
  record: IncidentCanonicalSource,
  version: number,
): Record<string, unknown> {
  return pickCanonicalFields(
    record,
    resolveCanonicalFieldSet(INCIDENT_CANONICAL_VERSIONS, version),
  );
}

/** Chaîne canonique d'un incident, telle que hachée puis re-vérifiée. */
export function incidentCanonicalString(record: IncidentCanonicalSource, version: number): string {
  return canonicalSerialize(incidentCanonicalProjection(record, version));
}

/**
 * Version sous laquelle une ligne doit être vérifiée. Les lignes antérieures au
 * versionnage portent 1 (défaut de colonne) ; le `?? 1` couvre en plus une
 * lecture faite avant l'ALTER TABLE.
 */
export function canonicalVersionOf(record: { canonicalVersion?: number | null }): number {
  return record.canonicalVersion ?? 1;
}
