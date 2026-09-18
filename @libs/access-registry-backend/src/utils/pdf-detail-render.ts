import type PDFDocument from "pdfkit";
import type { AccessRecordEntityType } from "#src/entities/access-record.entity.js";
import { COLORS, MARGIN, CONTENT_WIDTH, PAGE } from "#src/utils/pdf-constants.js";
import { drawSectionTitle } from "#src/utils/pdf-table.js";
import { drawSingleLine } from "@libs/backend-shared";
import {
  buildBlocks,
  CARD_PADDING,
  TITLE_HEIGHT,
  type Block,
} from "#src/utils/pdf-detail-blocks.js";

type Doc = InstanceType<typeof PDFDocument>;

const CARD_GAP = 12;
const USABLE_HEIGHT = PAGE.height - MARGIN.bottom - MARGIN.top;

function drawCardFrame(doc: Doc, y: number, cardHeight: number): void {
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

function drawCardTitle(doc: Doc, record: AccessRecordEntityType, y: number, continued: boolean) {
  const accent = record.isSpecialCategory ? COLORS.danger : COLORS.primary;
  const art9 = record.isSpecialCategory ? " · données art. 9" : "";
  const suffix = continued ? " (suite)" : "";
  doc.font("Helvetica-Bold").fontSize(10).fillColor(accent);
  drawSingleLine(
    doc,
    `Enregistrement #${record.seq}${art9}${suffix}`,
    MARGIN.left + CARD_PADDING,
    y,
    CONTENT_WIDTH - CARD_PADDING * 2,
  );
}

/**
 * Combien de blocs, à partir de `index`, tiennent dans `available` points.
 * Un bloc sécable (champ libre) trop haut est coupé en deux et `blocks` est
 * modifié en place : la première moitié remplit la page, le reste suit.
 */
function takeBlocksForPage(
  blocks: Block[],
  index: number,
  available: number,
): { end: number; used: number } {
  let used = 0;
  let end = index;
  while (end < blocks.length && used + blocks[end]!.height <= available) {
    used += blocks[end]!.height;
    end += 1;
  }
  const parts = blocks[end]?.split?.(available - used);
  if (parts) {
    blocks.splice(end, 1, parts[0], parts[1]);
    used += parts[0].height;
    end += 1;
  }
  return { end, used };
}

// Fiche détaillée d'un enregistrement : tous les champs (label → valeur), hash
// complets. Champs courts sur 2 colonnes (densité), justification et hash en
// pleine largeur. La fiche n'est jamais coupée si elle tient sur une page ; si
// son contenu dépasse une page entière, elle se poursuit sur la suivante dans un
// cadre « (suite) » plutôt que de déborder hors de la zone imprimable.
// @lat: [[backend/access-registry#Export PDF : liste puis détail]]
function drawRecordCard(doc: Doc, record: AccessRecordEntityType): void {
  const blocks = buildBlocks(doc, record);
  const contentHeight = blocks.reduce((total, block) => total + block.height, 0);
  const fullHeight = CARD_PADDING * 2 + TITLE_HEIGHT + contentHeight;
  const bottom = PAGE.height - MARGIN.bottom;

  // La fiche entière tient sur une page mais pas dans ce qu'il reste de celle-ci :
  // on saute plutôt que de la couper.
  if (fullHeight <= USABLE_HEIGHT && doc.y + fullHeight > bottom) {
    doc.addPage();
    doc.y = MARGIN.top;
  }

  let index = 0;
  let continued = false;
  while (index < blocks.length) {
    const top = doc.y;
    const available = bottom - top - CARD_PADDING * 2 - TITLE_HEIGHT;
    const chunk = takeBlocksForPage(blocks, index, available);

    // Pas même un bloc ne rentre dans le reste de la page : on passe à la
    // suivante. Sur une page vierge, on force le bloc pour éviter une boucle.
    if (chunk.end === index && top > MARGIN.top) {
      doc.addPage();
      doc.y = MARGIN.top;
      continue;
    }
    const end = chunk.end === index ? index + 1 : chunk.end;
    const used = chunk.end === index ? blocks[index]!.height : chunk.used;

    const cardHeight = CARD_PADDING * 2 + TITLE_HEIGHT + used;
    drawCardFrame(doc, top, cardHeight);
    drawCardTitle(doc, record, top + CARD_PADDING, continued);

    let y = top + CARD_PADDING + TITLE_HEIGHT;
    for (let i = index; i < end; i += 1) {
      blocks[i]!.draw(y);
      y += blocks[i]!.height;
    }

    doc.y = top + cardHeight + CARD_GAP;
    index = end;
    continued = true;
  }
}

export function drawRecordsDetail(doc: Doc, records: AccessRecordEntityType[]) {
  if (records.length === 0) return;
  drawSectionTitle(doc, "Détail des enregistrements");
  records.forEach((record) => drawRecordCard(doc, record));
}
