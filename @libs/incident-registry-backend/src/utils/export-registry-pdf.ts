import PDFDocument from "pdfkit";
import { drawSingleLine, measureHeight } from "@libs/backend-shared";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";

export type PdfAttestation = {
  generatedAt: string;
  generatedBy: string;
  count: number;
  chainHeadHash: string;
  integrityOk: boolean;
  integrityBrokenAt?: number;
  integrityReason?: string;
};

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { top: 48, right: 48, bottom: 56, left: 48 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

const COLORS = {
  primary: "#1e3a5f",
  accent: "#0284c7",
  success: "#059669",
  successBg: "#ecfdf5",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  surface: "#f8fafc",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  white: "#ffffff",
  rowAlt: "#f1f5f9",
};

// Largeurs calibrées sur la mesure réelle du contenu le plus large attendu :
// une date `jj/mm/aaaa hh:mm` fait 58,4 pt en Helvetica 7,5, et un statut comme
// « Résolu (Phase 1) » ne tenait pas dans 58 pt.
const TABLE_COLUMNS = [
  { key: "seq", label: "#", width: 24 },
  { key: "reference", label: "Réf.", width: 104 },
  { key: "clientCode", label: "Client", width: 46 },
  { key: "status", label: "Statut", width: 78 },
  { key: "reportDate", label: "Rapport", width: 76 },
  { key: "specialCategoryData", label: "Art.9", width: 30 },
  { key: "hash", label: "Hash", width: CONTENT_WIDTH - 358 },
] as const;

/** Padding horizontal interne d'une cellule du journal. */
const CELL_PADDING = 8;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function countSpecial(records: IncidentEntityType[]): number {
  return records.filter((record) => record.specialCategoryData).length;
}

function drawPageFooter(
  doc: InstanceType<typeof PDFDocument>,
  pageIndex: number,
  pageCount: number,
  generatedAt: string,
) {
  const y = PAGE.height - MARGIN.bottom + 18;
  // Le footer s'écrit SOUS la marge basse : le line-wrapper de pdfkit (activé par
  // `width`, nécessaire ici pour l'alignement à droite) y voit un dépassement de
  // maxY et déclenche un addPage() par footer posé — le PDF gagnait une page
  // fantôme par page réelle. Marge neutralisée le temps du dessin.
  const savedBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc
    .save()
    .strokeColor(COLORS.border)
    .moveTo(MARGIN.left, y - 8)
    .lineTo(PAGE.width - MARGIN.right, y - 8)
    .stroke()
    .restore();

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(`Généré le ${formatDate(generatedAt)}`, MARGIN.left, y, { lineBreak: false })
    .text(`Page ${pageIndex + 1} / ${pageCount}`, MARGIN.left, y, {
      width: CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    });
  doc.page.margins.bottom = savedBottomMargin;
}

function drawHeader(doc: InstanceType<typeof PDFDocument>, attestation: PdfAttestation) {
  const headerHeight = 88;
  doc.save().rect(0, 0, PAGE.width, headerHeight).fill(COLORS.primary).restore();

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(COLORS.white)
    .text("Registre des incidents", MARGIN.left, 28, { lineBreak: false });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#cbd5e1")
    .text("Export conforme RGPD · traçabilité et intégrité", MARGIN.left, 54, { lineBreak: false });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.white)
    .text(formatDate(attestation.generatedAt), MARGIN.left, 28, {
      width: CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    });

  doc.y = headerHeight + 24;
}

function drawStatCards(
  doc: InstanceType<typeof PDFDocument>,
  attestation: PdfAttestation,
  specialCount: number,
) {
  const cardHeight = 54;
  const gap = 12;
  const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;
  const y = doc.y;

  const cards = [
    { label: "Incidents", value: String(attestation.count), tone: COLORS.accent },
    {
      label: "Intégrité",
      value: attestation.integrityOk ? "Validée" : "Compromise",
      tone: attestation.integrityOk ? COLORS.success : COLORS.danger,
    },
    { label: "Données art. 9", value: String(specialCount), tone: COLORS.primary },
  ];

  cards.forEach((card, index) => {
    const x = MARGIN.left + index * (cardWidth + gap);
    doc.save().roundedRect(x, y, cardWidth, cardHeight, 8).fill(COLORS.surface).restore();
    doc
      .save()
      .lineWidth(1)
      .strokeColor(COLORS.border)
      .roundedRect(x, y, cardWidth, cardHeight, 8)
      .stroke()
      .restore();

    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted);
    drawSingleLine(doc, card.label.toUpperCase(), x + 14, y + 12, cardWidth - 28);

    doc.font("Helvetica-Bold").fontSize(18).fillColor(card.tone);
    drawSingleLine(doc, card.value, x + 14, y + 28, cardWidth - 28);
  });

  doc.y = y + cardHeight + 20;
}

function drawIntegrityCard(doc: InstanceType<typeof PDFDocument>, attestation: PdfAttestation) {
  const y = doc.y;
  const accent = attestation.integrityOk ? COLORS.success : COLORS.danger;
  const bg = attestation.integrityOk ? COLORS.successBg : COLORS.dangerBg;

  const statusText = attestation.integrityOk
    ? `Chaîne de hash vérifiée — ${attestation.count} incident(s) cohérent(s).`
    : `Chaîne compromise à l'index ${attestation.integrityBrokenAt ?? "?"} (${attestation.integrityReason ?? "inconnu"}).`;

  // La hauteur du cadre suit le texte : un motif de rupture verbeux se replie sur
  // plusieurs lignes et débordait d'un cadre à hauteur fixe.
  const textWidth = CONTENT_WIDTH - 32;
  doc.font("Helvetica").fontSize(9);
  const cardHeight = 14 + 18 + measureHeight(doc, statusText, textWidth) + 10 + 12 + 14;

  doc.save().roundedRect(MARGIN.left, y, CONTENT_WIDTH, cardHeight, 10).fill(bg).restore();
  doc.save().rect(MARGIN.left, y, 4, cardHeight).fill(accent).restore();
  doc
    .save()
    .lineWidth(1)
    .strokeColor(COLORS.border)
    .roundedRect(MARGIN.left, y, CONTENT_WIDTH, cardHeight, 10)
    .stroke()
    .restore();

  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.text);
  drawSingleLine(doc, "Attestation d'intégrité", MARGIN.left + 16, y + 14, textWidth);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(accent)
    .text(statusText, MARGIN.left + 16, y + 32, { width: textWidth });

  doc.font("Courier").fontSize(7.5).fillColor(COLORS.muted);
  drawSingleLine(
    doc,
    `Tête de chaîne : ${attestation.chainHeadHash}`,
    MARGIN.left + 16,
    y + cardHeight - 22,
    textWidth,
  );

  doc.y = y + cardHeight + 22;
}

function drawSectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.text).text(title, MARGIN.left, doc.y);
  doc.moveDown(0.6);
}

function drawTableHeader(doc: InstanceType<typeof PDFDocument>, y: number): number {
  const rowHeight = 24;
  doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, rowHeight).fill(COLORS.primary).restore();

  let x = MARGIN.left + CELL_PADDING;
  for (const column of TABLE_COLUMNS) {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.white);
    drawSingleLine(doc, column.label, x, y + 8, column.width - CELL_PADDING);
    x += column.width;
  }

  return y + rowHeight;
}

function rowValues(record: IncidentEntityType): string[] {
  return [
    String(record.seq),
    record.reference ?? "—",
    record.clientCode ?? "—",
    record.status ?? "—",
    formatDate(record.reportDate),
    record.specialCategoryData ? "Oui" : "Non",
    record.hash ?? "—",
  ];
}

function drawTableRow(
  doc: InstanceType<typeof PDFDocument>,
  record: IncidentEntityType,
  y: number,
  rowIndex: number,
): number {
  const rowHeight = 22;
  const bg = rowIndex % 2 === 0 ? COLORS.white : COLORS.rowAlt;
  doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, rowHeight).fill(bg).restore();

  const values = rowValues(record);
  let x = MARGIN.left + CELL_PADDING;
  values.forEach((value, index) => {
    const column = TABLE_COLUMNS[index]!;
    doc
      .font(index === values.length - 1 ? "Courier" : "Helvetica")
      .fontSize(7.5)
      .fillColor(index === 5 && record.specialCategoryData ? COLORS.danger : COLORS.text);
    // Une ligne du journal est de hauteur fixe : la cellule est tronquée à la
    // mesure plutôt que renvoyée à la ligne (sinon la 2ᵉ ligne débordait sous le
    // filet de séparation).
    drawSingleLine(doc, value, x, y + 7, column.width - CELL_PADDING);
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

function drawRecordsTable(doc: InstanceType<typeof PDFDocument>, records: IncidentEntityType[]) {
  drawSectionTitle(doc, "Journal des incidents");

  if (records.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("Aucun incident dans le registre.", MARGIN.left, doc.y + 8, { lineBreak: false });
    doc.y += 28;
    return;
  }

  let y = drawTableHeader(doc, doc.y);
  records.forEach((record, index) => {
    if (y + 22 > PAGE.height - MARGIN.bottom) {
      doc.addPage();
      y = drawTableHeader(doc, MARGIN.top);
    }
    y = drawTableRow(doc, record, y, index);
  });
  doc.y = y + 8;
}

function applyFooters(doc: InstanceType<typeof PDFDocument>, generatedAt: string) {
  const range = doc.bufferedPageRange();
  const pageCount = range.count;
  for (let i = range.start; i < range.start + pageCount; i++) {
    doc.switchToPage(i);
    drawPageFooter(doc, i, pageCount, generatedAt);
  }
}

export function buildRegistryPdf(
  records: IncidentEntityType[],
  attestation: PdfAttestation,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.left, right: MARGIN.right },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, attestation);
    drawStatCards(doc, attestation, countSpecial(records));
    drawIntegrityCard(doc, attestation);
    drawRecordsTable(doc, records);

    applyFooters(doc, attestation.generatedAt);
    doc.end();
  });
}
