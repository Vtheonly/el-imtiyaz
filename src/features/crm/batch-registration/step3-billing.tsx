/**
 * Step 3 — Billing config (reads from PricingConfig).
 *
 * Shows the registration-fee + transport toggles and a per-student breakdown
 * with the 3-tranche tuition split. Pure presentational component — state
 * and the `billing` useMemo live in the orchestrator.
 *
 * Spec §2.1 — adds a "Générer Devis PDF" button that produces a printable
 * quote/invoice for the parent showing the full breakdown per child and
 * per tranche, ready to hand to parents before payment is finalized.
 */
import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "../../../shared/ui/button";
import { useToast } from "../../../app/providers/toast-provider";
import { formatDzd } from "../../../core/format/currency";
import { generateQuotationPdf, downloadPdf, type QuotationInput } from "../../../infrastructure/receipt-pdf";
import type { Billing } from "./types";
import type { Step1Parent } from "./types";

export function Step3({
  billing,
  includeRegistration,
  setIncludeRegistration,
  includeTransport,
  setIncludeTransport,
  parent,
}: {
  billing: Billing;
  includeRegistration: boolean;
  setIncludeRegistration: (b: boolean) => void;
  includeTransport: boolean;
  setIncludeTransport: (b: boolean) => void;
  /** Spec §2.1 — parent info for the quotation PDF header. */
  parent: Step1Parent;
}) {
  const toast = useToast();
  const [generating, setGenerating] = useState(false);

  // Spec §2.1 — generate the quotation PDF and trigger a browser download.
  async function handleGenerateQuote() {
    setGenerating(true);
    try {
      const input: QuotationInput = {
        parentName: `${parent.firstName} ${parent.lastName}`.trim() || "Parent (à renseigner)",
        parentPhone: parent.phone || undefined,
        parentEmail: parent.email || undefined,
        parentAddress: parent.address || undefined,
        students: billing.perStudent.map((s) => ({
          name: s.name,
          level: s.level,
          tuition: s.tuition,
          transport: s.transport,
          tranches: s.tranches,
        })),
        registrationFee: billing.registrationFee,
        totalTuition: billing.totalTuition,
        totalTransport: billing.totalTransport,
        grandTotal: billing.grandTotal,
        discountNote: billing.perStudent.length > 1
          ? `Remise fratrie: -5,000 DA par enfant supplementaire (${billing.perStudent.length - 1} enfant(s))`
          : undefined,
      };
      const pdfBytes = await generateQuotationPdf(input);
      const fileName = `devis-${parent.lastName || "parent"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadPdf(pdfBytes, fileName);
      toast.showSuccess("Devis généré", fileName);
    } catch (e) {
      toast.showError("Échec de la génération", e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/5">
          <input
            type="checkbox"
            checked={includeRegistration}
            onChange={(e) => setIncludeRegistration(e.target.checked)}
            className="h-4 w-4"
          />
          <div>
            <p className="text-sm font-medium">Frais d'inscription</p>
            <p className="text-xs text-muted-foreground">Facturé une fois à l'inscription</p>
          </div>
          <span className="ml-auto font-mono text-sm">{formatDzd(billing.registrationFee)}</span>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/5">
          <input
            type="checkbox"
            checked={includeTransport}
            onChange={(e) => setIncludeTransport(e.target.checked)}
            className="h-4 w-4"
          />
          <div>
            <p className="text-sm font-medium">Transport scolaire</p>
            <p className="text-xs text-muted-foreground">Basé sur la zone de résidence</p>
          </div>
          <span className="ml-auto font-mono text-sm">{formatDzd(billing.totalTransport)}</span>
        </label>
      </div>

      {/* Spec §2.1 — "Générer Devis / Facture PDF" button */}
      <div className="flex items-center justify-between rounded-md border border-status-info/30 bg-status-info/5 p-3">
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 text-status-info mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Devis / Facture PDF</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Génère un PDF imprimable avec le détail par enfant et par tranche — prêt à remettre au parent.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateQuote}
          disabled={generating || billing.perStudent.length === 0}
          className="shrink-0"
        >
          {generating ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération…</>
          ) : (
            <><Download className="h-3.5 w-3.5" /> Générer Devis PDF</>
          )}
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <div className="border-b border-border px-3 py-2 bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Détail par élève
          </p>
        </div>
        <ul className="divide-y divide-border">
          {billing.perStudent.map((s) => (
            <li key={s.index} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{s.level}</span>
                </div>
                <span className="font-mono text-sm font-semibold">
                  {formatDzd(s.tuition + s.transport)}
                </span>
              </div>
              <div className="pl-3 text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Scolarité (3 tranches)</span>
                  <span className="font-mono">{formatDzd(s.tuition)}</span>
                </div>
                <div className="pl-3 text-[10px]">
                  {s.tranches.map((t, idx) => (
                    <div key={t.label} className="flex justify-between">
                      <span>
                        {t.label}
                        {idx === 0 && " · S1 Sept–Nov"}
                        {idx === 1 && " · S2 Dec–Feb"}
                        {idx === 2 && " · S3 Mar–May"}
                      </span>
                      <span className="font-mono">{formatDzd(t.amountDue)}</span>
                    </div>
                  ))}
                </div>
                {s.transport > 0 && (
                  <div className="flex justify-between">
                    <span>Transport</span>
                    <span className="font-mono">{formatDzd(s.transport)}</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-3 py-2 bg-muted/30 flex justify-between">
          <span className="text-sm font-semibold">Total facturé</span>
          <span className="font-mono text-base font-bold text-primary">{formatDzd(billing.grandTotal)}</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Les tarifs proviennent de la configuration administrateur (Paramètres → Tarification).
        Modifier un tarif ici n'affecte pas la configuration.
      </p>
    </div>
  );
}
