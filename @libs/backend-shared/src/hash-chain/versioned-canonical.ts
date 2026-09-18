/**
 * Projection canonique VERSIONNÉE.
 *
 * Problème résolu : la liste des champs entrant dans le hash d'une table
 * append-only ne peut pas changer sans invalider les hashs déjà écrits, alors
 * que le schéma métier doit pouvoir grandir (nouvelles colonnes réglementaires).
 * La solution est de figer une liste par version et de stocker sur chaque ligne
 * la version sous laquelle elle a été écrite, de sorte que la vérification
 * rejoue exactement la liste en vigueur au moment de l'écriture.
 *
 * Deux invariants portent toute la garantie :
 *
 * 1. Une version DÉPLOYÉE est immuable. Modifier la liste d'une version dont
 *    des lignes existent en production casse leur vérification, sans migration
 *    possible (les triggers append-only interdisent le ré-hachage). Chaque
 *    domaine doit donc figer ses versions par un test à hash de référence.
 * 2. Le numéro de version appartient au jeu canonique dès la version qui
 *    l'introduit. Il est une affirmation sur la façon d'interpréter la ligne :
 *    la lier au hash permet de prouver sous quelle liste la ligne a été écrite,
 *    au lieu de devoir faire confiance à la colonne telle qu'elle est lue.
 */

/** Liste ordonnée-indifférente des champs canoniques d'une version. */
export type CanonicalFieldSet<Field extends string = string> = readonly Field[];

/** Registre `version -> champs`. Les versions déployées n'y changent jamais. */
export type CanonicalFieldSetRegistry<Field extends string = string> = Readonly<
  Record<number, CanonicalFieldSet<Field>>
>;

/**
 * Projette un enregistrement sur les champs d'une version.
 *
 * L'affectation est INCONDITIONNELLE : une propriété absente de l'objet source
 * est écrite à `undefined` et reste donc présente dans les clés, ce que
 * `canonicalSerialize` sérialise en `null`. C'est exactement le comportement
 * d'un littéral d'objet énumérant tous les champs, donc les hashs déjà écrits
 * avant l'introduction de cette fonction restent valides. Ne pas remplacer par
 * un test de présence (`in`), qui changerait la chaîne canonique.
 */
export function pickCanonicalFields<Field extends string>(
  record: { readonly [K in Field]?: unknown },
  fields: CanonicalFieldSet<Field>,
): Record<string, unknown> {
  const projection: Record<string, unknown> = {};
  for (const field of fields) {
    projection[field] = record[field];
  }
  return projection;
}

/**
 * Résout la liste de champs d'une version. Échoue bruyamment sur une version
 * inconnue : une ligne portant une version que le code ne connaît pas ne doit
 * jamais être déclarée « intègre » par défaut (fail-closed).
 */
export function resolveCanonicalFieldSet<Field extends string>(
  registry: CanonicalFieldSetRegistry<Field>,
  version: number,
): CanonicalFieldSet<Field> {
  const fields = registry[version];
  if (!fields) {
    throw new Error(
      `canonical version inconnue: ${version} (versions connues: ${Object.keys(registry).join(", ")})`,
    );
  }
  return fields;
}
