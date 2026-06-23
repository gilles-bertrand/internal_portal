import type PDFDocument from "pdfkit";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import {
  COLORS,
  MARGIN,
  CONTENT_WIDTH,
  PAGE,
  TABLE_COLUMNS,
  formatDate,
  truncate,
} from "#src/utils/pdf-constants.js";

export function drawSectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text(title, MARGIN.left, doc.y);
  doc.moveDown(0.6);
}

export function drawTableHeader(doc: InstanceType<typeof PDFDocument>, y: number): number {
  const rowHeight = 24;
  doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, rowHeight).fill(COLORS.primary).restore();

  let x = MARGIN.left + 8;
  for (const column of TABLE_COLUMNS) {
    doc
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(COLORS.white)
      .text(column.label, x, y + 8, { width: column.width - 8, lineBreak: false });
    x += column.width;
  }

  return y + rowHeight;
}

export function drawTableRow(
  doc: InstanceType<typeof PDFDocument>,
  record: AccessRecordEntityType,
  y: number,
  rowIndex: number,
): number {
  const rowHeight = 22;
  const bg = rowIndex % 2 === 0 ? COLORS.white : COLORS.rowAlt;
  doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, rowHeight).fill(bg).restore();

  const values = [
    String(record.seq),
    formatDate(record.accessedAt),
    truncate(record.dataSubjectRef, 16),
    truncate(record.accessType, 12),
    truncate(record.purpose, 14),
    record.isSpecialCategory ? "Oui" : "Non",
    truncate(record.hash, 22),
  ];

  let x = MARGIN.left + 8;
  values.forEach((value, index) => {
    const column = TABLE_COLUMNS[index]!;
    doc
      .font(index === values.length - 1 ? "Courier" : "Helvetica")
      .fontSize(7.5)
      .fillColor(index === 5 && record.isSpecialCategory ? COLORS.danger : COLORS.text)
      .text(value, x, y + 7, { width: column.width - 8, lineBreak: false });
    x += column.width;
  });

  doc
    .save()
    .strokeColor(COLORS.border)
    .moveTo(MARGIN.left, y + rowHeight)
    .lineTo(MARGIN.left + CONTENT_WIDTH, y + rowHeight)
    .stroke()
    .restore();

  return y + rowHeight;
}

export function drawRecordsTable(
  doc: InstanceType<typeof PDFDocument>,
  records: AccessRecordEntityType[],
) {
  drawSectionTitle(doc, "Journal des accès");

  let y = drawTableHeader(doc, doc.y);
  records.forEach((record, index) => {
    if (y + 22 > PAGE.height - MARGIN.bottom) {
      doc.addPage();
      y = MARGIN.top;
      y = drawTableHeader(doc, y);
    }
    y = drawTableRow(doc, record, y, index);
  });
  doc.y = y + 8;

  if (records.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("Aucun enregistrement dans le registre.", MARGIN.left, y + 8);
    doc.y = y + 28;
  }
}
