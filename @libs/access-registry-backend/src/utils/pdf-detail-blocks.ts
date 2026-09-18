// Mise en page mesurée d'une fiche détaillée : chaque champ devient un bloc dont
// la hauteur est connue AVANT tout tracé, ce qui permet au rendu de faire grandir
// la fiche et de la paginer sans jamais superposer deux lignes.
// @lat: [[backend/access-registry#Export PDF : mise en page mesurée]]
import type PDFDocument from "pdfkit";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { COLORS, MARGIN, CONTENT_WIDTH } from "#src/utils/pdf-constants.js";
import { buildRecordDetailRows, type DetailRow } from "#src/utils/pdf-detail.js";
import { drawSingleLine, measureHeight, wrapLines } from "@libs/backend-shared";

type Doc = InstanceType<typeof PDFDocument>;

export const CARD_PADDING = 14;
export const TITLE_HEIGHT = 22;
const COL_GAP = 20;
const LABEL_GAP = 10;
/** Label le plus large de la fiche : « PERSONNE CONCERNÉE » = 86 pt en Helvetica-Bold 7. */
const LABEL_WIDTH = 90;
const ROW_GAP = 5;
const LABEL_FONT_SIZE = 7;
const VALUE_FONT_SIZE = 8;
const MONO_FONT_SIZE = 7;

const COL_WIDTH = (CONTENT_WIDTH - CARD_PADDING * 2 - COL_GAP) / 2;
const GRID_VALUE_WIDTH = COL_WIDTH - LABEL_WIDTH - LABEL_GAP;
const FULL_VALUE_WIDTH = CONTENT_WIDTH - CARD_PADDING * 2 - LABEL_WIDTH - LABEL_GAP;

/** Bloc de contenu déjà mesuré : la hauteur est connue avant tout tracé. */
export type Block = {
  height: number;
  draw: (y: number) => void;
  /**
   * Coupe le bloc pour que sa première moitié tienne dans `maxHeight`.
   * `null` quand le bloc est insécable ou qu'il tient déjà.
   */
  split?: (maxHeight: number) => [Block, Block] | null;
};

function applyLabelFont(doc: Doc): void {
  doc.font("Helvetica-Bold").fontSize(LABEL_FONT_SIZE).fillColor(COLORS.muted);
}

function applyValueFont(doc: Doc, mono: boolean): void {
  doc
    .font(mono ? "Courier" : "Helvetica")
    .fontSize(mono ? MONO_FONT_SIZE : VALUE_FONT_SIZE)
    .fillColor(COLORS.text);
}

// Hauteur d'une cellule label→valeur : le label tient sur une ligne (tronqué à
// la mesure), la valeur peut se replier sur plusieurs lignes.
function cellHeight(doc: Doc, row: DetailRow, valueWidth: number): number {
  applyLabelFont(doc);
  const labelHeight = doc.currentLineHeight();
  applyValueFont(doc, row.mono === true);
  return Math.max(labelHeight, measureHeight(doc, row.value, valueWidth));
}

function drawCell(doc: Doc, row: DetailRow, x: number, y: number, valueWidth: number): void {
  applyLabelFont(doc);
  drawSingleLine(doc, row.label.toUpperCase(), x, y + 1, LABEL_WIDTH);
  applyValueFont(doc, row.mono === true);
  // Une valeur mono (hash de 64 caractères) ne doit jamais être coupée en deux
  // lignes : elle tient par construction, on la sécurise par une troncature à la
  // mesure. Les autres valeurs se replient normalement dans leur colonne.
  if (row.mono === true) {
    drawSingleLine(doc, row.value, x + LABEL_WIDTH + LABEL_GAP, y, valueWidth);
    return;
  }
  doc.text(row.value, x + LABEL_WIDTH + LABEL_GAP, y, { width: valueWidth });
}

// Bloc pleine largeur d'un champ libre (justification) : déjà découpé en lignes,
// donc sécable d'une page à l'autre. Un texte de plusieurs milliers de caractères
// ne peut plus déborder sous la marge basse ni recouvrir le pied de page.
// @lat: [[backend/access-registry#Export PDF : mise en page mesurée]]
function textBlock(doc: Doc, label: string, lines: string[], x: number): Block {
  applyValueFont(doc, false);
  // `true` = interligne inclus, pour coller au rendu multi-ligne natif de pdfkit
  // utilisé par les cellules de la grille.
  const lineHeight = doc.currentLineHeight(true);
  const height = Math.max(lines.length, 1) * lineHeight + ROW_GAP;

  const block: Block = {
    height,
    draw: (y) => {
      applyLabelFont(doc);
      drawSingleLine(doc, label.toUpperCase(), x, y + 1, LABEL_WIDTH);
      applyValueFont(doc, false);
      lines.forEach((line, index) => {
        doc.text(line, x + LABEL_WIDTH + LABEL_GAP, y + index * lineHeight, { lineBreak: false });
      });
    },
    split: (maxHeight) => {
      const fitting = Math.floor((maxHeight - ROW_GAP) / lineHeight);
      if (fitting < 1 || fitting >= lines.length) {
        return null;
      }
      return [
        textBlock(doc, label, lines.slice(0, fitting), x),
        textBlock(doc, label, lines.slice(fitting), x),
      ];
    },
  };
  return block;
}

// Transforme les champs d'un enregistrement en blocs mesurés : une paire de
// champs courts par bloc « grille », un bloc pleine largeur par champ long
// (justification) ou mono (hash). La hauteur d'un bloc grille est celle de sa
// cellule la plus haute — c'est ce qui empêche une valeur repliée d'écrire
// par-dessus la ligne suivante.
// @lat: [[backend/access-registry#Export PDF : mise en page mesurée]]
export function buildBlocks(doc: Doc, record: AccessRecordEntityType): Block[] {
  const rows = buildRecordDetailRows(record);
  const gridRows = rows.filter((row) => row.mono !== true && row.full !== true);
  const wideRows = rows.filter((row) => row.mono === true || row.full === true);
  const blocks: Block[] = [];

  const leftX = MARGIN.left + CARD_PADDING;
  const rightX = leftX + COL_WIDTH + COL_GAP;

  for (let index = 0; index < gridRows.length; index += 2) {
    const left = gridRows[index]!;
    const right = gridRows[index + 1];
    const height =
      Math.max(
        cellHeight(doc, left, GRID_VALUE_WIDTH),
        right ? cellHeight(doc, right, GRID_VALUE_WIDTH) : 0,
      ) + ROW_GAP;
    blocks.push({
      height,
      draw: (y) => {
        drawCell(doc, left, leftX, y, GRID_VALUE_WIDTH);
        if (right) {
          drawCell(doc, right, rightX, y, GRID_VALUE_WIDTH);
        }
      },
    });
  }

  for (const row of wideRows) {
    if (row.full === true) {
      applyValueFont(doc, false);
      blocks.push(textBlock(doc, row.label, wrapLines(doc, row.value, FULL_VALUE_WIDTH), leftX));
      continue;
    }
    const height = cellHeight(doc, row, FULL_VALUE_WIDTH) + ROW_GAP;
    blocks.push({ height, draw: (y) => drawCell(doc, row, leftX, y, FULL_VALUE_WIDTH) });
  }

  return blocks;
}
