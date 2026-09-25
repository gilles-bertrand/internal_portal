// @lat: [[frontend/access-record-options#Libellés bilingues résolus côté frontend]]
// Les référentiels backend (purpose, legalBasis, dataCategories, sourceSystem)
// exposent deux libellés — `label` (français, jamais nul) et `labelEn`
// (anglais, nullable). La résolution se fait ICI, à l'affichage, et non côté
// serveur via Accept-Language : le sélecteur de langue du dashboard change la
// locale sans rechargement, donc un libellé résolu au fetch resterait figé dans
// l'ancienne langue.

// Forme minimale commune aux quatre référentiels ; volontairement structurelle
// pour accepter aussi bien un enregistrement WarpDrive qu'un objet simple.
export interface BilingualReferential {
  code: string;
  label: string;
  labelEn?: string | null;
}

// `en-us`, `en-GB`, `en`… → anglais ; tout le reste retombe sur le français,
// seule langue dont le libellé est garanti non nul.
export function prefersEnglish(locale: string | undefined): boolean {
  return (locale ?? '').toLowerCase().startsWith('en');
}

// Libellé d'affichage d'un référentiel dans la locale demandée. Fallback sur le
// français quand `labelEn` est absent : c'est le cas des systèmes sources créés
// à la volée depuis le formulaire, qui n'ont qu'un libellé saisi par l'utilisateur.
export function localizedLabel(
  referential: BilingualReferential,
  locale: string | undefined
): string {
  if (prefersEnglish(locale)) {
    return referential.labelEn || referential.label;
  }
  return referential.label;
}

// Résout un code stocké (`purpose: 'support'`) en libellé lisible. Les
// access-records persistent le code du référentiel, pas son libellé : sans cette
// résolution, la vue détail et le tableau affichent des codes bruts (« support »,
// « art6.1b »). Retombe sur le code lui-même si le référentiel est introuvable —
// un référentiel supprimé ne doit pas faire disparaître la donnée du registre.
export function labelForCode(
  referentials: readonly BilingualReferential[] | undefined,
  code: string | null | undefined,
  locale: string | undefined
): string {
  if (!code) {
    return '';
  }
  const match = referentials?.find((r) => r.code === code);
  return match ? localizedLabel(match, locale) : code;
}
