import type { AppAbility } from "@libs/permissions-backend";

// Un événement du journal appartient au domaine que son `targetType` désigne.
//
// Les valeurs écrites suivent une convention de préfixe : `incident`,
// `incident_list`, `incident_export` d'un côté, `access_record`,
// `access_record_list`, `access_record_export`, `access_record_retention` de
// l'autre. On s'appuie sur ce préfixe plutôt que d'énumérer chaque valeur : une
// route qui ajoute `incident_verify` demain reste correctement rattachée.
//
// @lat: [[backend/audit-log#Journal exposé par son propre module#Le journal est filtré par domaine, pas ouvert en bloc]]
const SUBJECT_BY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ["incident", "Incident"],
  ["access_record", "AccessRecord"],
];

/**
 * Sujet CASL dont relève un événement, ou `undefined` si son `targetType` n'est
 * rattaché à aucun domaine connu.
 */
export function subjectForTargetType(targetType: string): string | undefined {
  return SUBJECT_BY_PREFIX.find(([prefix]) => targetType.startsWith(prefix))?.[1];
}

/**
 * Un appelant ne voit un événement que s'il peut lire le domaine qu'il concerne.
 *
 * SANS CE FILTRE, LE JOURNAL CONTOURNE LE RBAC. Constaté en production le
 * 2026-09-18 : `tech_admin` reçoit un 403 sur tout le préfixe `/incidents` — la
 * règle `manage Incident` lui est explicitement refusée — et lisait pourtant 78
 * événements d'incidents par le journal : qui a créé, consulté, exporté et
 * supprimé quel incident, horodaté et nominatif. Le journal rendait donc
 * observable exactement ce que l'interdiction voulait soustraire.
 *
 * Un `targetType` inconnu est masqué plutôt qu'exposé : un domaine ajouté sans
 * son préfixe doit disparaître du journal, jamais s'y montrer à tous. Le défaut
 * doit aller vers la discrétion — l'inverse de la règle des drapeaux de
 * fonctionnalité, parce que l'enjeu est inverse.
 */
export function canReadAuditEvent(ability: AppAbility, targetType: string): boolean {
  const subject = subjectForTargetType(targetType);
  if (subject === undefined) {
    return false;
  }
  return ability.can("read", subject);
}
