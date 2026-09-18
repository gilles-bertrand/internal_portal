import type PDFDocument from "pdfkit";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import {
  COLORS,
  MARGIN,
  CONTENT_WIDTH,
  PAGE,
  SUMMARY_COLUMNS,
  SUMMARY_CELL_PADDING,
} from "#src/utils/pdf-constants.js";
import { buildSummaryCells } from "#src/utils/pdf-summary.js";
import { drawSingleLine } from "@libs/backend-shared";

// Titre de section. `lineBreak: false` empêche pdfkit d'avancer `doc.y` (il
// décale `doc.x` à la place) : l'ordonnée suivante est donc posée à la main,
// sinon le premier bloc de la section se dessine par-dessus le titre.
export function drawSectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text);
  drawSingleLine(doc, title, MARGIN.left, y, CONTENT_WIDTH);
  doc.x = MARGIN.left;
  doc.y = y + doc.currentLineHeight() + 8;
}

const SUMMARY_ROW_HEIGHT = 20;
const HEADER_HEIGHT = 22;
/** Décalage vertical du texte pour le centrer dans sa ligne (police 7,5 pt). */
const CELL_TEXT_OFFSET = 6;

function drawSummaryHeader(doc: InstanceType<typeof PDFDocument>, y: number): number {
  doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, HEADER_HEIGHT).fill(COLORS.primary).restore();
  let x = MARGIN.left + SUMMARY_CELL_PADDING;
  for (const column of SUMMARY_COLUMNS) {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.white);
    drawSingleLine(doc, column.label, x, y + 7, column.width - SUMMARY_CELL_PADDING);
    x += column.width;
  }
  return y + HEADER_HEIGHT;
}

function drawSummaryRow(
  doc: InstanceType<typeof PDFDocument>,
  record: AccessRecordEntityType,
  y: number,
  rowIndex: number,
): number {
  const bg = rowIndex % 2 === 0 ? COLORS.white : COLORS.rowAlt;
  doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, SUMMARY_ROW_HEIGHT).fill(bg).restore();

  const cells = buildSummaryCells(record);
  let x = MARGIN.left + SUMMARY_CELL_PADDING;
  cells.forEach((value, index) => {
    const column = SUMMARY_COLUMNS[index]!;
    const isArt9Col = column.key === "isSpecialCategory";
    doc
      .font(column.key === "hash" ? "Courier" : "Helvetica")
      .fontSize(7.5)
      .fillColor(isArt9Col && record.isSpecialCategory ? COLORS.danger : COLORS.text);
    // Une ligne du récapitulatif est de hauteur fixe : la cellule est tronquée à
    // la mesure plutôt que renvoyée à la ligne (sinon la 2ᵉ ligne débordait sous
    // le filet de séparation).
    drawSingleLine(doc, value, x, y + CELL_TEXT_OFFSET, column.width - SUMMARY_CELL_PADDING);
    x += column.width;
  });

  doc
    .save()
    .strokeColor(COLORS.border)
    .moveTo(MARGIN.left, y + SUMMARY_ROW_HEIGHT)
    .lineTo(MARGIN.left + CONTENT_WIDTH, y + SUMMARY_ROW_HEIGHT)
    .stroke()
    .restore();
  return y + SUMMARY_ROW_HEIGHT;
}

// Liste récapitulative (page 1) : une ligne compacte par enregistrement, avant
// les fiches détaillées. @lat: [[backend/access-registry#Export PDF : liste puis détail]]
export function drawSummaryTable(
  doc: InstanceType<typeof PDFDocument>,
  records: AccessRecordEntityType[],
) {
  drawSectionTitle(doc, "Liste des accès");

  if (records.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("Aucun enregistrement dans le registre.", MARGIN.left, doc.y + 8, {
        lineBreak: false,
      });
    doc.y += 28;
    return;
  }

  let y = drawSummaryHeader(doc, doc.y);
  records.forEach((record, index) => {
    if (y + SUMMARY_ROW_HEIGHT > PAGE.height - MARGIN.bottom) {
      doc.addPage();
      y = drawSummaryHeader(doc, MARGIN.top);
    }
    y = drawSummaryRow(doc, record, y, index);
  });
  doc.y = y + 8;
}
