/**
 * Quotation / Invoice PDF generator — spec §2.1.
 *
 * Generates a printable PDF quote ("Devis / Facture") during student
 * registration, showing the full fee breakdown per child and per tranche.
 *
 * Used by the BatchRegistrationModal Step 3 ("Générer Devis PDF" button) so
 * staff can hand parents a formal breakdown before payment is finalized.
 *
 * Layout:
 *   1. Brand header + "DEVIS / FACTURE PROVISOIRE" title
 *   2. Quote meta (number, date, parent info)
 *   3. Per-student breakdown table (name, level, tuition, transport, tranches)
 *   4. Totals (registration, tuition, transport, grand total)
 *   5. Tranche schedule summary (T1 = S1 Sept–Nov, etc.)
 *   6. Discounts note (10% annual, sibling −5,000, etc.)
 *   7. RIB for bank transfers
 *   8. Signature line
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  PAGE_W,
  PAGE_H,
  MARGIN,
  CONTENT_W,
  BORDER,
  BRAND_BLUE,
  BRAND_BLUE_DEEP,
  SUCCESS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  ACCENT_BG,
  PRIMARY_BG,
  drawHeader,
  drawFooter,
  drawKeyValue,
  drawBox,
  wrapText,
  sanitizePdfText,
} from "./shared";
import { formatDzdPlain } from "../../core/format/currency";
import { formatDate, formatDateTime } from "../../core/format/date";

/** Per-student billing data passed from BatchRegistrationModal Step 3. */
export interface QuotationStudent {
  readonly name: string;
  readonly level: string;
  readonly tuition: number;
  readonly transport: number;
  readonly tranches: ReadonlyArray<{ label: string; amountDue: number }>;
}

/** Input for the quotation PDF generator. */
export interface QuotationInput {
  readonly parentName: string;
  readonly parentPhone?: string;
  readonly parentEmail?: string;
  readonly parentAddress?: string;
  readonly students: QuotationStudent[];
  readonly registrationFee: number;
  readonly totalTuition: number;
  readonly totalTransport: number;
  readonly grandTotal: number;
  /** Optional quote number — auto-generated if not provided. */
  readonly quoteNumber?: string;
  /** Optional discount to display (e.g. "Remise fratrie: -5,000 DA"). */
  readonly discountNote?: string;
}

export async function generateQuotationPdf(input: QuotationInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const title = "DEVIS / FACTURE";
  const page = drawHeader(doc, font, title);

  let y = PAGE_H - 110;

  // === Quote meta box ===
  const quoteNum = input.quoteNumber ?? `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  drawBox(page, MARGIN, y - 56, CONTENT_W, 56, ACCENT_BG, BORDER);
  drawKeyValue(page, font, MARGIN + 15, y - 18, "Devis N°:", quoteNum);
  drawKeyValue(page, font, MARGIN + 15, y - 36, "Date:", formatDateTime(new Date().toISOString()));
  drawKeyValue(page, font, MARGIN + 280, y - 18, "Annee scolaire:", `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`);
  drawKeyValue(page, font, MARGIN + 280, y - 36, "Validite:", "30 jours");

  y -= 70;

  // === Parent section ===
  page.drawText("PARENT / TUTEUR", { x: MARGIN, y, size: 10, font: fontBold, color: TEXT_PRIMARY });
  y -= 16;
  const parentBoxH = input.parentAddress || input.parentEmail ? 56 : 38;
  drawBox(page, MARGIN, y - parentBoxH, CONTENT_W, parentBoxH, rgb(0xf7 / 255, 0xf9 / 255, 0xfb / 255), BORDER);
  drawKeyValue(page, font, MARGIN + 15, y - 16, "Nom:", sanitizePdfText(input.parentName));
  if (input.parentPhone) {
    drawKeyValue(page, font, MARGIN + 280, y - 16, "Telephone:", input.parentPhone);
  }
  if (input.parentEmail) {
    drawKeyValue(page, font, MARGIN + 15, y - 34, "E-mail:", sanitizePdfText(input.parentEmail));
  }
  if (input.parentAddress) {
    drawKeyValue(page, font, MARGIN + 280, y - 34, "Adresse:", sanitizePdfText(input.parentAddress));
  }

  y -= parentBoxH + 14;

  // === Per-student breakdown table ===
  page.drawText("DETAIL PAR ELEVE", { x: MARGIN, y, size: 10, font: fontBold, color: TEXT_PRIMARY });
  y -= 16;

  // Table header
  drawBox(page, MARGIN, y - 18, CONTENT_W, 18, BRAND_BLUE_DEEP);
  page.drawText("Eleve", { x: MARGIN + 10, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Niveau", { x: MARGIN + 180, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Scolarite", { x: MARGIN + 260, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Transport", { x: MARGIN + 340, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("Total", { x: MARGIN + 440, y: y - 12, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  y -= 20;

  // Student rows
  for (const s of input.students) {
    if (y < 200) {
      // Page break if running low on space
      drawFooter(page, font, new Date().toISOString());
      const newPage = drawHeader(doc, font, title);
      y = PAGE_H - 110;
      void newPage;
    }
    const rowH = 22;
    drawBox(page, MARGIN, y - rowH, CONTENT_W, rowH, undefined, BORDER);
    page.drawText(sanitizePdfText(s.name).slice(0, 25), { x: MARGIN + 10, y: y - 14, size: 9, font, color: TEXT_PRIMARY });
    page.drawText(sanitizePdfText(s.level).slice(0, 15), { x: MARGIN + 180, y: y - 14, size: 9, font, color: TEXT_MUTED });
    page.drawText(formatDzdPlain(s.tuition), { x: MARGIN + 260, y: y - 14, size: 9, font, color: TEXT_PRIMARY });
    page.drawText(formatDzdPlain(s.transport), { x: MARGIN + 340, y: y - 14, size: 9, font, color: TEXT_PRIMARY });
    page.drawText(formatDzdPlain(s.tuition + s.transport), { x: MARGIN + 440, y: y - 14, size: 9, font: fontBold, color: TEXT_PRIMARY });
    y -= rowH;

    // Tranche sub-rows
    if (s.tranches.length > 0) {
      page.drawText("Tranches:", { x: MARGIN + 30, y: y - 10, size: 8, font, color: TEXT_MUTED });
      const trancheStr = s.tranches
        .map((t) => `${t.label}: ${formatDzdPlain(t.amountDue)}`)
        .join("  |  ");
      const trancheLines = wrapText(sanitizePdfText(trancheStr), font, 8, CONTENT_W - 120);
      trancheLines.slice(0, 2).forEach((line, i) => {
        page.drawText(line, { x: MARGIN + 90, y: y - 10 - i * 10, size: 8, font, color: TEXT_MUTED });
      });
      y -= 14 + Math.min(trancheLines.length, 2) * 10;
    }
  }

  y -= 10;

  // === Totals box ===
  const totalsBoxH = input.discountNote ? 92 : 74;
  drawBox(page, MARGIN, y - totalsBoxH, CONTENT_W, totalsBoxH, PRIMARY_BG, BORDER);

  let ty = y - 18;
  page.drawText("Frais d'inscription:", { x: MARGIN + 20, y: ty, size: 10, font, color: TEXT_PRIMARY });
  page.drawText(formatDzdPlain(input.registrationFee), { x: MARGIN + 250, y: ty, size: 10, font, color: TEXT_PRIMARY });
  ty -= 16;

  page.drawText("Total scolarite:", { x: MARGIN + 20, y: ty, size: 10, font, color: TEXT_PRIMARY });
  page.drawText(formatDzdPlain(input.totalTuition), { x: MARGIN + 250, y: ty, size: 10, font, color: TEXT_PRIMARY });
  ty -= 16;

  page.drawText("Total transport:", { x: MARGIN + 20, y: ty, size: 10, font, color: TEXT_PRIMARY });
  page.drawText(formatDzdPlain(input.totalTransport), { x: MARGIN + 250, y: ty, size: 10, font, color: TEXT_PRIMARY });
  ty -= 16;

  if (input.discountNote) {
    page.drawText(sanitizePdfText(input.discountNote), { x: MARGIN + 20, y: ty, size: 9, font, color: SUCCESS });
    ty -= 14;
  }

  // Grand total line
  page.drawLine({
    start: { x: MARGIN + 15, y: ty - 2 },
    end: { x: MARGIN + CONTENT_W - 15, y: ty - 2 },
    thickness: 0.5,
    color: BORDER,
  });
  ty -= 16;
  page.drawText("TOTAL GENERAL", { x: MARGIN + 20, y: ty, size: 11, font: fontBold, color: TEXT_PRIMARY });
  page.drawText(formatDzdPlain(input.grandTotal) + " DZD", { x: MARGIN + 250, y: ty, size: 12, font: fontBold, color: BRAND_BLUE_DEEP });

  y -= totalsBoxH + 16;

  // === Tranche schedule legend ===
  if (y > 220) {
    page.drawText("ECHEANCIER DES TRANCHES", { x: MARGIN, y, size: 10, font: fontBold, color: TEXT_PRIMARY });
    y -= 14;
    drawBox(page, MARGIN, y - 44, CONTENT_W, 44, ACCENT_BG, BORDER);
    page.drawText("Tranche 1 = Semestre 1 (Sept-Oct-Nov) - a l'inscription", {
      x: MARGIN + 12, y: y - 14, size: 9, font, color: TEXT_PRIMARY,
    });
    page.drawText("Tranche 2 = Semestre 2 (Dec-Jan-Feb) - echeance 1-15 Decembre", {
      x: MARGIN + 12, y: y - 26, size: 9, font, color: TEXT_PRIMARY,
    });
    page.drawText("Tranche 3 = Semestre 3 (Mar-Apr-May) - echeance 1-15 Mars", {
      x: MARGIN + 12, y: y - 38, size: 9, font, color: TEXT_PRIMARY,
    });
    y -= 54;
  }

  // === Discounts note ===
  if (y > 180) {
    page.drawText("REMISES APPLICABLES", { x: MARGIN, y, size: 10, font: fontBold, color: TEXT_PRIMARY });
    y -= 14;
    const discounts = [
      "Paiement annuel complet avant le 30 juin: -10%",
      "Plus d'un enfant par famille: -5,000 DA par enfant supplementaire",
      "Passage de palier: -10,000 DA",
      "Anciennete > 5 ans: -5%",
    ];
    drawBox(page, MARGIN, y - 56, CONTENT_W, 56, rgb(0xf0 / 255, 0xfd / 255, 0xf4 / 255), BORDER);
    discounts.forEach((d, i) => {
      page.drawText(sanitizePdfText(`- ${d}`), {
        x: MARGIN + 12, y: y - 14 - i * 12, size: 9, font, color: TEXT_PRIMARY,
      });
    });
    y -= 66;
  }

  // === RIB ===
  if (y > 140) {
    page.drawText("COORDONNEES BANCAIRES (RIB)", { x: MARGIN, y, size: 10, font: fontBold, color: TEXT_PRIMARY });
    y -= 14;
    drawBox(page, MARGIN, y - 30, CONTENT_W, 30, rgb(0xfa / 255, 0xfa / 255, 0xfa / 255), BORDER);
    page.drawText("Banque: CPA Boumerdes", { x: MARGIN + 12, y: y - 12, size: 9, font, color: TEXT_PRIMARY });
    page.drawText("RIB: 004 00047 0001234567 89", { x: MARGIN + 12, y: y - 24, size: 9, font: fontBold, color: TEXT_PRIMARY });
    y -= 40;
  }

  // === Signature line ===
  const sigY = 90;
  page.drawText("Signature & cachet de l'etablissement", {
    x: PAGE_W - MARGIN - 180, y: sigY + 20, size: 9, font, color: TEXT_MUTED,
  });
  page.drawLine({
    start: { x: PAGE_W - MARGIN - 180, y: sigY },
    end: { x: PAGE_W - MARGIN, y: sigY },
    thickness: 0.5,
    color: BORDER,
  });

  // Acceptance line (parent signature)
  page.drawText("Bon pour accord (parent)", { x: MARGIN, y: sigY + 20, size: 9, font, color: TEXT_MUTED });
  page.drawLine({
    start: { x: MARGIN, y: sigY },
    end: { x: MARGIN + 180, y: sigY },
    thickness: 0.5,
    color: BORDER,
  });

  drawFooter(page, font, new Date().toISOString());
  return doc.save();
}
