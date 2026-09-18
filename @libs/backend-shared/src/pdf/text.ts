/**
 * Mesure de texte pour les gabarits PDF (pdfkit).
 *
 * Piège pdfkit central, à l'origine de la plupart des défauts d'affichage des
 * exports : `lineBreak: false` n'empêche PAS le retour à la ligne. L'option sert
 * seulement à ne pas déduire la largeur de la marge courante ; dès qu'une `width`
 * explicite est passée à `text()`, le line-wrapper s'active quand même et replie
 * le texte. Un gabarit qui positionne la ligne suivante à un `y` fixe se retrouve
 * alors avec deux ou trois lignes dans un emplacement dimensionné pour une seule,
 * et les lignes se recouvrent.
 *
 * Deux sorties, toutes deux fournies ici :
 * - cellule d'une ligne → tronquer à la largeur MESURÉE puis dessiner **sans**
 *   `width` ({@link fitText} / {@link drawSingleLine}) ;
 * - cellule multi-ligne → mesurer ({@link measureHeight}, {@link wrapLines}) et
 *   faire suivre la hauteur du conteneur, jamais l'inverse.
 */

/**
 * Sous-ensemble de `PDFDocument` utilisé ici. Structurellement satisfait par
 * pdfkit sans que ce paquet ait à en dépendre — les libs consommatrices n'ont
 * donc pas à aligner leur version de pdfkit sur la sienne.
 */
export interface PdfTextDoc {
  widthOfString(text: string, options?: Record<string, unknown>): number;
  heightOfString(text: string, options?: Record<string, unknown>): number;
  currentLineHeight(includeGap?: boolean): number;
  text(text: string, x?: number, y?: number, options?: Record<string, unknown>): unknown;
}

const ELLIPSIS = "…";

/**
 * Tronque `value` pour qu'il tienne dans `maxWidth` points, ellipse comprise.
 *
 * La troncature est faite à la mesure et non au nombre de caractères : une
 * limite en caractères ignore la largeur réelle des glyphes, donc coupe trop tôt
 * les valeurs étroites et laisse déborder les larges.
 */
export function fitText(doc: PdfTextDoc, value: string, maxWidth: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (maxWidth <= 0) {
    return "";
  }
  if (doc.widthOfString(text) <= maxWidth) {
    return text;
  }
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (doc.widthOfString(`${text.slice(0, mid).trimEnd()}${ELLIPSIS}`) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${text.slice(0, low).trimEnd()}${ELLIPSIS}`;
}

/**
 * Dessine un texte garanti sur UNE ligne : tronqué à la mesure, puis rendu sans
 * `width` pour que le line-wrapper de pdfkit ne s'active jamais.
 *
 * ⚠️ Sans `width`, pdfkit avance `doc.x` et **pas** `doc.y` : un appelant qui
 * empile des lignes doit poser l'ordonnée suivante lui-même.
 */
export function drawSingleLine(
  doc: PdfTextDoc,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  doc.text(fitText(doc, value, maxWidth), x, y, { lineBreak: false });
}

/** Hauteur réelle d'un texte multi-ligne dans la police/taille courantes. */
export function measureHeight(doc: PdfTextDoc, value: string, width: number): number {
  return doc.heightOfString(value, { width });
}

function breakLongWord(
  doc: PdfTextDoc,
  word: string,
  width: number,
): { lines: string[]; rest: string } {
  const lines: string[] = [];
  let rest = word;
  while (doc.widthOfString(rest) > width && rest.length > 1) {
    let cut = rest.length - 1;
    while (cut > 1 && doc.widthOfString(rest.slice(0, cut)) > width) {
      cut -= 1;
    }
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  return { lines, rest };
}

function wrapParagraph(doc: PdfTextDoc, paragraph: string, width: number): string[] {
  const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [""];
  }
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (doc.widthOfString(candidate) <= width) {
      current = candidate;
      continue;
    }
    if (current !== "") {
      lines.push(current);
    }
    // Mot plus large que la colonne (identifiant, URL) : coupé au caractère.
    const broken = breakLongWord(doc, word, width);
    lines.push(...broken.lines);
    current = broken.rest;
  }
  lines.push(current);
  return lines;
}

/**
 * Découpe un texte en lignes tenant dans `width`, avec les métriques de la
 * police courante.
 *
 * pdfkit sait replier un texte mais pas dire OÙ il le replie : disposer des
 * lignes est indispensable pour qu'un champ libre très long puisse se poursuivre
 * d'une page à l'autre au lieu de déborder sous la marge basse.
 */
export function wrapLines(doc: PdfTextDoc, value: string, width: number): string[] {
  return value.split(/\r?\n/).flatMap((paragraph) => wrapParagraph(doc, paragraph, width));
}
