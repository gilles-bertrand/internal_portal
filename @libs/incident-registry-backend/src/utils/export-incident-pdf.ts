import PDFDocument from "pdfkit";
import type { IncidentEntityType } from "#src/entities/incident.entity.js";

type DescriptionSection = { title: string; body?: string; items?: string[] };
type ImpactDetails = { nature?: string[]; severityIntro?: string; severityPoints?: string[] };
type Signature = { name: string; role?: string; org?: string; date?: string };
type CorrectiveAction = {
  phase?: string;
  order: number;
  title: string;
  detail: string;
  completedAt?: string;
};
type TimelineEvent = { date: string; time: string; event: string };
type AccessLog = { date: string; user: string; email: string; files: string; count: number };

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { top: 48, right: 48, bottom: 56, left: 48 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

const C = {
  headerDark: "#1F3864",
  headerMid: "#2E5496",
  section: "#1F3864",
  subsection: "#2E5496",
  confidential: "#C00000",
  text: "#1F1F1F",
  muted: "#595959",
  border: "#BFBFBF",
  white: "#FFFFFF",
  rowAlt: "#F2F2F2",
  rowHeader: "#1F3864",
};

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTimeFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} à ${hh}h${min}`;
}

function needsPage(doc: InstanceType<typeof PDFDocument>, needed: number) {
  if (doc.y + needed > PAGE.height - MARGIN.bottom) {
    doc.addPage();
    doc.y = MARGIN.top;
  }
}

function drawSection(doc: InstanceType<typeof PDFDocument>, n: number, title: string) {
  needsPage(doc, 32);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(C.section)
    .text(`${n}. ${title}`, MARGIN.left, doc.y);
  doc.moveDown(0.5);
}

function drawSubSection(doc: InstanceType<typeof PDFDocument>, label: string) {
  needsPage(doc, 24);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(C.subsection).text(label, MARGIN.left, doc.y);
  doc.moveDown(0.35);
}

function drawParagraph(doc: InstanceType<typeof PDFDocument>, text: string) {
  needsPage(doc, 20);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(C.text)
    .text(text, MARGIN.left, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.4);
}

function drawBulletList(doc: InstanceType<typeof PDFDocument>, items: string[]) {
  for (const item of items) {
    needsPage(doc, 18);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(C.text)
      .text(`• ${item}`, MARGIN.left + 8, doc.y, { width: CONTENT_WIDTH - 8 });
    doc.moveDown(0.25);
  }
}

function drawNumberedList(doc: InstanceType<typeof PDFDocument>, items: string[], startIndex = 1) {
  for (let i = 0; i < items.length; i++) {
    needsPage(doc, 18);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(C.text)
      .text(`${startIndex + i}.  ${items[i]}`, MARGIN.left + 8, doc.y, {
        width: CONTENT_WIDTH - 8,
      });
    doc.moveDown(0.25);
  }
}

function drawKeyValueTable(
  doc: InstanceType<typeof PDFDocument>,
  rows: { label: string; value: string }[],
  labelWidth = 160,
) {
  const valueWidth = CONTENT_WIDTH - labelWidth;
  const rowH = 18;

  for (let i = 0; i < rows.length; i++) {
    needsPage(doc, rowH + 2);
    const y = doc.y;
    const bg = i % 2 === 0 ? C.white : C.rowAlt;

    doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, rowH).fill(bg).restore();
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(C.border)
      .rect(MARGIN.left, y, CONTENT_WIDTH, rowH)
      .stroke()
      .restore();

    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(C.text)
      .text(rows[i]!.label, MARGIN.left + 6, y + 5, { width: labelWidth - 8, lineBreak: false });

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(C.text)
      .text(rows[i]!.value, MARGIN.left + labelWidth + 4, y + 5, {
        width: valueWidth - 8,
        lineBreak: false,
      });

    doc.y = y + rowH;
  }
  doc.moveDown(0.6);
}

interface DataTableColumn {
  label: string;
  width: number;
  bold?: boolean;
}

function drawDataTable(
  doc: InstanceType<typeof PDFDocument>,
  columns: DataTableColumn[],
  rows: string[][],
) {
  const rowH = 20;
  const headerH = 22;

  const renderHeader = (y: number): number => {
    doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, headerH).fill(C.rowHeader).restore();
    let x = MARGIN.left + 6;
    for (const col of columns) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(C.white)
        .text(col.label, x, y + 7, { width: col.width - 8, lineBreak: false });
      x += col.width;
    }
    return y + headerH;
  };

  let y = renderHeader(doc.y);

  for (let ri = 0; ri < rows.length; ri++) {
    if (y + rowH > PAGE.height - MARGIN.bottom) {
      doc.addPage();
      y = MARGIN.top;
      y = renderHeader(y);
    }
    const bg = ri % 2 === 0 ? C.white : C.rowAlt;
    doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, rowH).fill(bg).restore();
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(C.border)
      .moveTo(MARGIN.left, y + rowH)
      .lineTo(MARGIN.left + CONTENT_WIDTH, y + rowH)
      .stroke()
      .restore();

    let x = MARGIN.left + 6;
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci]!;
      const val = rows[ri]![ci] ?? "";
      doc
        .font(col.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(8.5)
        .fillColor(C.text)
        .text(val, x, y + 6, { width: col.width - 8, lineBreak: false });
      x += col.width;
    }
    y += rowH;
  }
  doc.y = y;
  doc.moveDown(0.6);
}

function drawSignatureBlock(
  doc: InstanceType<typeof PDFDocument>,
  issuer: Signature,
  recipient: Signature,
) {
  needsPage(doc, 120);
  const colW = CONTENT_WIDTH / 2 - 6;
  const headerH = 22;
  const y0 = doc.y;

  const cols = [
    { label: "Émetteur du rapport", sig: issuer, x: MARGIN.left },
    { label: "Destinataire", sig: recipient, x: MARGIN.left + colW + 12 },
  ];

  for (const col of cols) {
    doc.save().rect(col.x, y0, colW, headerH).fill(C.rowHeader).restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(C.white)
      .text(col.label, col.x + 8, y0 + 7, { width: colW - 16, lineBreak: false });
  }

  const bodyY = y0 + headerH;
  const bodyH = 90;

  for (const col of cols) {
    doc.save().rect(col.x, bodyY, colW, bodyH).fill(C.white).restore();
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(C.border)
      .rect(col.x, bodyY, colW, bodyH)
      .stroke()
      .restore();

    let lineY = bodyY + 8;
    const fields: { key: string; val: string }[] = [
      { key: "Nom", val: col.sig.name },
      { key: "Fonction", val: col.sig.role ?? "—" },
      { key: issuer === col.sig ? "Société" : "Organisation", val: col.sig.org ?? "—" },
      { key: "Date", val: col.sig.date ? formatDateFr(`${col.sig.date}T00:00:00.000Z`) : "—" },
      { key: "Signature", val: "_________________________" },
    ];
    for (const field of fields) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(C.text)
        .text(`${field.key} : `, col.x + 8, lineY, { continued: true });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(C.text)
        .text(field.val, { width: colW - 20 });
      lineY = doc.y + 2;
    }
  }

  doc.y = bodyY + bodyH + 10;
}

function drawTitleBlock(doc: InstanceType<typeof PDFDocument>, incident: IncidentEntityType) {
  const bannerH = 40;
  const subBannerH = 24;

  doc.save().rect(0, 0, PAGE.width, bannerH).fill(C.headerDark).restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(C.white)
    .text("RAPPORT D'INCIDENT", 0, 12, { width: PAGE.width, align: "center", lineBreak: false });

  doc.save().rect(0, bannerH, PAGE.width, subBannerH).fill(C.headerMid).restore();
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(C.white)
    .text(incident.applicationName, 0, bannerH + 7, {
      width: PAGE.width,
      align: "center",
      lineBreak: false,
    });

  doc.y = bannerH + subBannerH + 14;

  const periodStart = formatDateTimeFr(incident.incidentStartAt);
  const periodEnd = incident.incidentEndAt ? formatDateTimeFr(incident.incidentEndAt) : "En cours";

  drawKeyValueTable(doc, [
    { label: "Référence", value: incident.reference },
    { label: "Date du rapport", value: formatDateFr(incident.reportDate) },
    { label: "Version", value: incident.version },
    { label: "Classification", value: incident.classification },
    { label: "Application concernée", value: incident.applicationName },
    { label: "Environnement", value: incident.environment },
    { label: "Période de l'incident", value: `Du ${periodStart} au ${periodEnd}` },
    { label: "Statut", value: incident.status },
    { label: "Rapport établi par", value: incident.encodedBy },
    { label: "Destinataire", value: incident.recipientName ?? "—" },
    { label: "Incident signalé par", value: incident.reportedBy },
  ]);
}

function drawConfidentialBanners(doc: InstanceType<typeof PDFDocument>) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(C.confidential)
      .text("CONFIDENTIEL", MARGIN.left, 14, {
        width: CONTENT_WIDTH,
        align: "right",
        lineBreak: false,
      });
  }
}

function drawReportFooters(doc: InstanceType<typeof PDFDocument>, incident: IncidentEntityType) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i);
    const y = PAGE.height - MARGIN.bottom + 10;
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(C.border)
      .moveTo(MARGIN.left, y - 4)
      .lineTo(PAGE.width - MARGIN.right, y - 4)
      .stroke()
      .restore();
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C.muted)
      .text(
        `Triptyk SRL — Rapport d'incident ${incident.reference} — Version ${incident.version} — ${formatDateFr(incident.reportDate)} | Page ${i + 1}`,
        MARGIN.left,
        y,
        { width: CONTENT_WIDTH, align: "center", lineBreak: false },
      );
  }
}

export function buildIncidentPdf(incident: IncidentEntityType): Promise<Buffer> {
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

    // ─── En-tête (bandeau titre + table de couverture) ───────────────────
    doc.y = 0;
    drawTitleBlock(doc, incident);

    // ─── §1 — Objet et cadre légal ────────────────────────────────────────
    drawSection(doc, 1, "Objet et cadre légal");
    if (incident.legalContext) {
      for (const para of incident.legalContext.split("\n\n")) {
        drawParagraph(doc, para.trim());
      }
    }
    doc.moveDown(0.4);

    // ─── §2 — Informations générales ─────────────────────────────────────
    drawSection(doc, 2, "Informations générales");
    const resolutionDuration = incident.resolutionDurationMinutes
      ? `${incident.resolutionDurationMinutes} minutes`
      : "—";
    drawKeyValueTable(doc, [
      { label: "Application", value: incident.applicationName },
      { label: "Service concerné", value: incident.serviceName ?? "—" },
      { label: "Environnement", value: incident.environment },
      { label: "Début de l'incident", value: formatDateTimeFr(incident.incidentStartAt) },
      {
        label: "Fin de l'incident",
        value: incident.incidentEndAt ? formatDateTimeFr(incident.incidentEndAt) : "En cours",
      },
      { label: "Détection", value: formatDateTimeFr(incident.detectedAt) },
      {
        label: "Résolution",
        value: incident.resolvedAt ? formatDateTimeFr(incident.resolvedAt) : "En cours",
      },
      { label: "Durée de résolution", value: resolutionDuration },
      { label: "Incident signalé par", value: incident.reportedBy },
      {
        label: "Données personnelles impactées",
        value: incident.personalDataImpacted
          ? `Oui — ${incident.specialCategoryData ? "Données sensibles (catégorie spéciale RGPD art. 9)" : "Données ordinaires"}`
          : "Non",
      },
    ]);

    // ─── §3 — Description ─────────────────────────────────────────────────
    drawSection(doc, 3, "Description de l'incident");
    if (incident.description) {
      for (const para of incident.description.split("\n\n")) {
        drawParagraph(doc, para.trim());
      }
    }
    const descSections = incident.descriptionSections as DescriptionSection[] | null;
    if (descSections?.length) {
      for (const sec of descSections) {
        drawSubSection(doc, sec.title);
        if (sec.body) drawParagraph(doc, sec.body);
        if (sec.items?.length) drawBulletList(doc, sec.items);
      }
    }
    doc.moveDown(0.4);

    // ─── §4 — Impact ──────────────────────────────────────────────────────
    drawSection(doc, 4, "Impact de l'incident");
    const impactDetails = incident.impactDetails as ImpactDetails | null;

    drawSubSection(doc, "4.1 Nature de l'impact");
    if (impactDetails?.nature?.length) {
      drawBulletList(doc, impactDetails.nature);
    } else if (incident.impactSummary) {
      drawParagraph(doc, incident.impactSummary);
    }

    drawSubSection(doc, "4.2 Évaluation de la criticité");
    if (impactDetails?.severityIntro) {
      drawParagraph(doc, impactDetails.severityIntro);
    } else if (incident.severityOverall) {
      drawParagraph(doc, `Impact global : ${incident.severityOverall}.`);
    }
    if (impactDetails?.severityPoints?.length) {
      drawBulletList(doc, impactDetails.severityPoints);
    } else {
      const points: string[] = [];
      if (incident.severityOperational)
        points.push(`Criticité opérationnelle : ${incident.severityOperational}`);
      if (incident.severityCompliance)
        points.push(`Criticité conformité : ${incident.severityCompliance}`);
      if (incident.affectedPersonsCount != null)
        points.push(`Personnes affectées : ${incident.affectedPersonsCount}`);
      if (incident.affectedPatientsCount != null)
        points.push(`Patients affectés : ${incident.affectedPatientsCount}`);
      if (points.length) drawBulletList(doc, points);
    }
    doc.moveDown(0.4);

    // ─── §5 — Chronologie ─────────────────────────────────────────────────
    drawSection(doc, 5, "Chronologie des événements");
    const timelineRows = (incident.timelineEvents as TimelineEvent[]).map((e) => [
      e.date.includes("T") ? formatDateFr(e.date) : e.date,
      e.time,
      e.event,
    ]);
    drawDataTable(
      doc,
      [
        { label: "Date", width: 90 },
        { label: "Heure", width: 70 },
        { label: "Événement", width: CONTENT_WIDTH - 160 },
      ],
      timelineRows,
    );

    // ─── §6 — Analyse des causes ──────────────────────────────────────────
    drawSection(doc, 6, "Analyse des causes");
    drawSubSection(doc, "6.1 Cause immédiate");
    drawParagraph(doc, incident.immediateCause);
    const factors = incident.contributingFactors as string[];
    if (factors?.length) {
      drawSubSection(doc, "6.2 Facteurs contributifs");
      drawBulletList(doc, factors);
    }
    doc.moveDown(0.4);

    // ─── §7 — Mesures ─────────────────────────────────────────────────────
    drawSection(doc, 7, "Mesures prises et correctifs appliqués");
    const actions = incident.correctiveActions as CorrectiveAction[];
    if (actions?.length) {
      const byPhase = new Map<string, CorrectiveAction[]>();
      for (const a of actions) {
        const phase = a.phase ?? "Mesures";
        const existing = byPhase.get(phase) ?? [];
        existing.push(a);
        byPhase.set(phase, existing);
      }
      let subIndex = 1;
      let globalOrder = 1;
      for (const [phase, phaseActions] of byPhase) {
        drawSubSection(doc, `7.${subIndex} Correction — ${phase}`);
        const items = phaseActions.map(
          (a) =>
            `${a.title}${a.detail ? ` — ${a.detail}` : ""}${a.completedAt ? ` (${formatDateTimeFr(a.completedAt)})` : ""}`,
        );
        drawNumberedList(doc, items, globalOrder);
        globalOrder += items.length;
        subIndex++;
      }
    }
    const prevMeasures = incident.preventiveMeasures as string[];
    if (prevMeasures?.length) {
      const subIndex = (incident.correctiveActions as CorrectiveAction[])
        ? new Set(
            (incident.correctiveActions as CorrectiveAction[]).map((a) => a.phase ?? "Mesures"),
          ).size + 1
        : 1;
      const globalStart = (incident.correctiveActions as CorrectiveAction[])?.length
        ? (incident.correctiveActions as CorrectiveAction[]).length + 1
        : 1;
      drawSubSection(doc, `7.${subIndex} Mesures préventives`);
      drawNumberedList(doc, prevMeasures, globalStart);
    }
    doc.moveDown(0.4);

    // ─── §8 — Conclusion ──────────────────────────────────────────────────
    drawSection(doc, 8, "Conclusion");
    if (incident.conclusion) {
      for (const para of incident.conclusion.split("\n\n")) {
        drawParagraph(doc, para.trim());
      }
    }
    if (
      incident.apdNotificationRequired !== null &&
      incident.apdNotificationRequired !== undefined
    ) {
      drawParagraph(
        doc,
        `Notification APD requise : ${incident.apdNotificationRequired ? "Oui — à réaliser conformément à l'article 33 du RGPD." : "Non."}`,
      );
    }
    doc.moveDown(0.4);

    // ─── §9 — Annexes — Détail des accès ──────────────────────────────────
    const accessLogs = incident.accessLogs as AccessLog[] | null;
    if (accessLogs?.length) {
      drawSection(doc, 9, "Annexes — Détail des accès (logs)");
      drawParagraph(
        doc,
        "Le tableau ci-dessous récapitule les accès identifiés aux fichiers concernés :",
      );
      const logRows = accessLogs.map((l) => [
        l.date.includes("T") ? formatDateFr(l.date) : l.date,
        l.user,
        l.email,
        l.files,
        String(l.count),
      ]);
      drawDataTable(
        doc,
        [
          { label: "Date", width: 72 },
          { label: "Utilisateur", width: 100 },
          { label: "Email", width: 150 },
          { label: "Fichiers accédés", width: 130 },
          { label: "Nb accès", width: CONTENT_WIDTH - 452 },
        ],
        logRows,
      );
      const totalAccess = accessLogs.reduce((s, l) => s + l.count, 0);
      const distinctUsers = accessLogs.length;
      doc
        .font("Helvetica-Oblique")
        .fontSize(8.5)
        .fillColor(C.muted)
        .text(
          `Total : ${totalAccess} accès par ${distinctUsers} utilisateur${distinctUsers > 1 ? "s" : ""} distinct${distinctUsers > 1 ? "s" : ""}.`,
          MARGIN.left,
          doc.y,
          { width: CONTENT_WIDTH },
        );
      doc.moveDown(0.6);
    }

    // ─── §10 — Signatures ─────────────────────────────────────────────────
    drawSection(doc, 10, "Approbation et signatures");
    const issuer = incident.issuerSignature as Signature;
    const recipient = incident.recipientSignature as Signature;
    if (issuer && recipient) {
      drawSignatureBlock(doc, issuer, recipient);
    }

    // ─── Post-process : CONFIDENTIEL + pieds de page ──────────────────────
    drawConfidentialBanners(doc);
    drawReportFooters(doc, incident);

    doc.end();
  });
}
