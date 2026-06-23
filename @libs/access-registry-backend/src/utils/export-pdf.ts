import PDFDocument from "pdfkit";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { COLORS, MARGIN, CONTENT_WIDTH, PAGE, formatDate } from "#src/utils/pdf-constants.js";
import { drawRecordsTable } from "#src/utils/pdf-table.js";

export type PdfAttestation = {
  generatedAt: string;
  generatedBy: string;
  count: number;
  chainHeadHash: string;
  integrityOk: boolean;
  integrityBrokenAt?: number;
  integrityReason?: string;
};

function countSpecial(records: AccessRecordEntityType[]): number {
  return records.filter((record) => record.isSpecialCategory).length;
}

function drawPageFooter(
  doc: InstanceType<typeof PDFDocument>,
  pageIndex: number,
  pageCount: number,
  generatedAt: string,
) {
  const y = PAGE.height - MARGIN.bottom + 18;
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
}

function drawHeader(doc: InstanceType<typeof PDFDocument>, attestation: PdfAttestation) {
  const headerHeight = 88;
  doc.save().rect(0, 0, PAGE.width, headerHeight).fill(COLORS.primary).restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(COLORS.white)
    .text("Registre des accès", MARGIN.left, 28, { lineBreak: false });
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
    { label: "Enregistrements", value: String(attestation.count), tone: COLORS.accent },
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
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(card.label.toUpperCase(), x + 14, y + 12, { width: cardWidth - 28, lineBreak: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(card.tone)
      .text(card.value, x + 14, y + 28, { width: cardWidth - 28, lineBreak: false });
  });

  doc.y = y + cardHeight + 20;
}

function drawIntegrityCard(doc: InstanceType<typeof PDFDocument>, attestation: PdfAttestation) {
  const y = doc.y;
  const cardHeight = attestation.integrityOk ? 78 : 92;
  const accent = attestation.integrityOk ? COLORS.success : COLORS.danger;
  const bg = attestation.integrityOk ? COLORS.successBg : COLORS.dangerBg;

  doc.save().roundedRect(MARGIN.left, y, CONTENT_WIDTH, cardHeight, 10).fill(bg).restore();
  doc.save().rect(MARGIN.left, y, 4, cardHeight).fill(accent).restore();
  doc
    .save()
    .lineWidth(1)
    .strokeColor(COLORS.border)
    .roundedRect(MARGIN.left, y, CONTENT_WIDTH, cardHeight, 10)
    .stroke()
    .restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text("Attestation d'intégrité", MARGIN.left + 16, y + 14, { lineBreak: false });

  const statusText = attestation.integrityOk
    ? `Chaîne de hash vérifiée — ${attestation.count} enregistrement(s) cohérent(s).`
    : `Chaîne compromise à l'index ${attestation.integrityBrokenAt ?? "?"} (${attestation.integrityReason ?? "inconnu"}).`;

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(accent)
    .text(statusText, MARGIN.left + 16, y + 32, { width: CONTENT_WIDTH - 32 });
  doc
    .font("Courier")
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(`Tête de chaîne : ${attestation.chainHeadHash}`, MARGIN.left + 16, y + cardHeight - 22, {
      width: CONTENT_WIDTH - 32,
      lineBreak: false,
    });

  doc.y = y + cardHeight + 22;
}

function applyFooters(doc: InstanceType<typeof PDFDocument>, generatedAt: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawPageFooter(doc, i, range.count, generatedAt);
  }
}

export function buildPdf(
  records: AccessRecordEntityType[],
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
