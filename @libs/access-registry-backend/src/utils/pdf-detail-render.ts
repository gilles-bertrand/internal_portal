import type PDFDocument from "pdfkit";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { COLORS, MARGIN, CONTENT_WIDTH, PAGE } from "#src/utils/pdf-constants.js";
import { buildRecordDetailRows } from "#src/utils/pdf-detail.js";
import { drawSectionTitle } from "#src/utils/pdf-table.js";

const LINE_HEIGHT = 14;
const CARD_PADDING = 12;
const TITLE_HEIGHT = 20;
const COL_GAP = 18;
const COL_LABEL_WIDTH = 92;
const FULL_LABEL_WIDTH = 118;
const COL_WIDTH = (CONTENT_WIDTH - CARD_PADDING * 2 - COL_GAP) / 2;

type DetailRow = { label: string; value: string; mono?: boolean };

function ensureSpace(doc: InstanceType<typeof PDFDocument>, needed: number): void {
  if (doc.y + needed > PAGE.height - MARGIN.bottom) {
    doc.addPage();
    doc.y = MARGIN.top;
  }
}

function drawCardFrame(doc: InstanceType<typeof PDFDocument>, y: number, cardHeight: number): void {
  doc
    .save()
    .roundedRect(MARGIN.left, y, CONTENT_WIDTH, cardHeight, 8)
    .fill(COLORS.surface)
    .restore();
  doc
    .save()
    .lineWidth(1)
    .strokeColor(COLORS.border)
    .roundedRect(MARGIN.left, y, CONTENT_WIDTH, cardHeight, 8)
    .stroke()
    .restore();
}

// Cellule label→valeur (champ court, disposé en 2 colonnes).
function drawGridCell(
  doc: InstanceType<typeof PDFDocument>,
  row: DetailRow,
  x: number,
  rowY: number,
): void {
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text(row.label.toUpperCase(), x, rowY + 2, { width: COL_LABEL_WIDTH, lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.text)
    .text(row.value, x + COL_LABEL_WIDTH, rowY + 2, {
      width: COL_WIDTH - COL_LABEL_WIDTH,
      lineBreak: false,
    });
}

// Ligne pleine largeur (hash) : label puis valeur mono sur toute la largeur.
function drawFullRow(doc: InstanceType<typeof PDFDocument>, row: DetailRow, rowY: number): void {
  const x = MARGIN.left + CARD_PADDING;
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text(row.label.toUpperCase(), x, rowY + 2, { width: FULL_LABEL_WIDTH, lineBreak: false });
  doc
    .font("Courier")
    .fontSize(7)
    .fillColor(COLORS.text)
    .text(row.value, x + FULL_LABEL_WIDTH, rowY + 2, {
      width: CONTENT_WIDTH - CARD_PADDING * 2 - FULL_LABEL_WIDTH,
      lineBreak: false,
    });
}

// Fiche détaillée d'un enregistrement : tous les champs (label → valeur), hash
// complets. Champs courts sur 2 colonnes (densité), hash en pleine largeur.
// @lat: [[backend/access-registry#Export PDF : liste puis détail]]
function drawRecordCard(
  doc: InstanceType<typeof PDFDocument>,
  record: AccessRecordEntityType,
): void {
  const rows = buildRecordDetailRows(record);
  const gridRows = rows.filter((r) => !r.mono);
  const fullRows = rows.filter((r) => r.mono);
  const gridLines = Math.ceil(gridRows.length / 2);
  const cardHeight = TITLE_HEIGHT + (gridLines + fullRows.length) * LINE_HEIGHT + CARD_PADDING * 2;

  // Le bloc ne doit pas être coupé entre deux pages : on saute si nécessaire.
  ensureSpace(doc, cardHeight + 14);
  const y = doc.y;

  drawCardFrame(doc, y, cardHeight);

  const accent = record.isSpecialCategory ? COLORS.danger : COLORS.primary;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(accent)
    .text(
      `Enregistrement #${record.seq}${record.isSpecialCategory ? " · données art. 9" : ""}`,
      MARGIN.left + CARD_PADDING,
      y + CARD_PADDING,
      { width: CONTENT_WIDTH - CARD_PADDING * 2, lineBreak: false },
    );

  const gridTop = y + CARD_PADDING + TITLE_HEIGHT;
  const leftX = MARGIN.left + CARD_PADDING;
  const rightX = leftX + COL_WIDTH + COL_GAP;
  gridRows.forEach((row, index) => {
    const col = index % 2 === 0 ? leftX : rightX;
    const rowY = gridTop + Math.floor(index / 2) * LINE_HEIGHT;
    drawGridCell(doc, row, col, rowY);
  });

  let fullY = gridTop + gridLines * LINE_HEIGHT;
  for (const row of fullRows) {
    drawFullRow(doc, row, fullY);
    fullY += LINE_HEIGHT;
  }

  doc.y = y + cardHeight + 12;
}

export function drawRecordsDetail(
  doc: InstanceType<typeof PDFDocument>,
  records: AccessRecordEntityType[],
) {
  if (records.length === 0) return;
  drawSectionTitle(doc, "Détail des enregistrements");
  records.forEach((record) => drawRecordCard(doc, record));
}
