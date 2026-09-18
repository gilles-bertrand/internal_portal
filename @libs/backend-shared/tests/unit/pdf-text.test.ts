import { beforeEach, describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import { fitText, wrapLines } from "#src/pdf/text.js";

let doc: InstanceType<typeof PDFDocument>;

beforeEach(() => {
  doc = new PDFDocument({ size: "A4" });
  doc.font("Helvetica").fontSize(8);
});

describe("fitText", () => {
  // @lat: [[backend/access-registry#Export PDF : mise en page mesurée#Troncature à la mesure]]
  it("tronque à la largeur réelle mesurée, jamais au nombre de caractères", () => {
    const value = "Un libellé nettement trop large pour la colonne qui l'accueille";
    const fitted = fitText(doc, value, 60);

    expect(fitted.endsWith("…")).toBe(true);
    expect(doc.widthOfString(fitted)).toBeLessThanOrEqual(60);
  });

  it("laisse intacte une valeur qui tient déjà", () => {
    expect(fitText(doc, "court", 200)).toBe("court");
  });

  it("aplatit les retours à la ligne (une cellule d'une ligne reste sur une ligne)", () => {
    expect(fitText(doc, "deux\nlignes", 200)).toBe("deux lignes");
  });
});

describe("wrapLines", () => {
  // Régression : un champ libre long doit pouvoir être posé ligne par ligne pour
  // se poursuivre d'une page à l'autre — pdfkit replie le texte mais ne dit pas
  // où, donc le calcul de mise en page ne peut pas s'appuyer dessus.
  // @lat: [[backend/access-registry#Export PDF : mise en page mesurée#Blocs mesurés et sécables]]
  it("découpe en lignes qui tiennent toutes dans la largeur demandée", () => {
    const text =
      "Le médecin n'arrivait pas à encoder ces informations de facturation, le secrétariat social a donc demandé un accès temporaire.";
    const lines = wrapLines(doc, text, 120);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(doc.widthOfString(line)).toBeLessThanOrEqual(120);
    }
  });

  it("ne perd aucun mot du texte d'origine", () => {
    const text = "alpha bravo charlie delta echo foxtrot golf hotel india juliett";
    expect(wrapLines(doc, text, 60).join(" ").split(/\s+/)).toEqual(text.split(" "));
  });

  it("coupe au caractère un mot plus large que la colonne (hash, URL)", () => {
    const lines = wrapLines(doc, "a".repeat(400), 100);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(doc.widthOfString(line)).toBeLessThanOrEqual(100);
    }
    expect(lines.join("")).toBe("a".repeat(400));
  });
});
