import type PDFDocument from "pdfkit";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { COLORS, MARGIN, CONTENT_WIDTH, PAGE, SUMMARY_COLUMNS } from "#src/utils/pdf-constants.js";
import { buildSummaryCells } from "#src/utils/pdf-summary.js";

export function drawSectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text(title, MARGIN.left, doc.y);
  doc.moveDown(0.6);
}

const SUMMARY_ROW_HEIGHT = 20;

function drawSummaryHeader(doc: InstanceType<typeof PDFDocument>, y: number): number {
  doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, 22).fill(COLORS.primary).restore();
  let x = MARGIN.left + 8;
  for (const column of SUMMARY_COLUMNS) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(COLORS.white)
      .text(column.label, x, y + 7, { width: column.width - 8, lineBreak: false });
    x += column.width;
  }
  return y + 22;
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
  let x = MARGIN.left + 8;
  cells.forEach((value, index) => {
    const column = SUMMARY_COLUMNS[index]!;
    const isArt9Col = column.key === "isSpecialCategory";
    doc
      .font(column.key === "hash" ? "Courier" : "Helvetica")
      .fontSize(7.5)
      .fillColor(isArt9Col && record.isSpecialCategory ? COLORS.danger : COLORS.text)
      .text(value, x, y + 6, { width: column.width - 8, lineBreak: false });
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
      .text("Aucun enregistrement dans le registre.", MARGIN.left, doc.y + 8);
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
