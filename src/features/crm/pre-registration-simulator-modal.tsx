/**
 * PreRegistrationSimulatorModal — spec §2.2.
 *
 * Standalone simulation / projection tool accessible from the CRM page.
 * Lets staff run cost simulations for prospective parents *before* a formal
 * registration is created in the database.
 *
 * Staff can configure:
 *   - Number of children
 *   - Intended academic levels/cycles (primaire / CEM / lycée)
 *   - Transport options (zone)
 *   - Extracurricular clubs + complementary services (psychology, speech therapy)
 *
 * Outputs a complete projection of annual + tranche-based expenses, discount
 * eligibility, and curriculum requirements.
 *
 * This modal does NOT write to the database — it's a pure read-only
 * computation surface. When the prospect decides to enroll, staff click
 * "Lancer l'inscription" which opens the BatchRegistrationModal pre-filled.
 */
import { useMemo, useState } from "react";
import { Calculator, Plus, Trash2, Sparkles, Download, ArrowRight, HeartPulse, Speech } from "lucide-react";
import { useObservable } from "../../shared/hooks/use-observable";
import { useRepositories } from "../../app/providers/repository-provider";
import { UnifiedModal } from "../../shared/ui/unified-modal";
import { Button } from "../../shared/ui/button";
import { Input } from "../../shared/ui/input";
import { Badge } from "../../shared/ui/badge";
import { FormField } from "../../shared/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../shared/ui/select";
import { Separator } from "../../shared/ui/separator";
import { formatDzd, formatDzdPlain } from "../../core/format/currency";
import { tuitionForLevel, transportForTier, tuitionTranches } from "../../domain/model/pricing";
import { LEVEL_LABELS_FR, LEVEL_YEARS, type AcademicLevel } from "../../domain/model/student";
import type { CityTier } from "../../domain/model/parent";
import { useToast } from "../../app/providers/toast-provider";
import { generateQuotationPdf, downloadPdf, type QuotationInput } from "../../infrastructure/receipt-pdf";

interface SimStudent {
  firstName: string;
  level: AcademicLevel;
  gradeYear: number;
  transportTier: CityTier | "";
  clubs: string[];
  psychologyMode: "semester" | "annual" | null;
  speechTherapyMode: "semester" | "annual" | null;
}

const EMPTY_SIM_STUDENT: SimStudent = {
  firstName: "",
  level: "primaire",
  gradeYear: 1,
  transportTier: "",
  clubs: [],
  psychologyMode: null,
  speechTherapyMode: null,
};

const CLUB_OPTIONS: ReadonlyArray<{ qualifier: string; label: string }> = [
  { qualifier: "chess_club", label: "Échecs" },
  { qualifier: "english_club", label: "Anglais" },
  { qualifier: "sports_club", label: "Sport" },
  { qualifier: "arts_club", label: "Arts" },
];

export function PreRegistrationSimulatorModal({
  open,
  onOpenChange,
  onStartRegistration,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Open the BatchRegistrationModal when the prospect decides to enroll. */
  onStartRegistration?: () => void;
}) {
  const repos = useRepositories();
  const toast = useToast();
  const pricing = useObservable(() => repos.pricing.observe(), []);
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [students, setStudents] = useState<SimStudent[]>([{ ...EMPTY_SIM_STUDENT }]);
  const [includeRegistration, setIncludeRegistration] = useState(true);

  function update(i: number, patch: Partial<SimStudent>) {
    setStudents(students.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function toggleClub(i: number, qualifier: string) {
    const s = students[i];
    const has = s.clubs.includes(qualifier);
    update(i, {
      clubs: has ? s.clubs.filter((c) => c !== qualifier) : [...s.clubs, qualifier],
    });
  }
  function addStudent() {
    setStudents([...students, { ...EMPTY_SIM_STUDENT }]);
  }
  function removeStudent(i: number) {
    if (students.length === 1) return;
    setStudents(students.filter((_, idx) => idx !== i));
  }

  // === Billing computation (mirrors BatchRegistrationModal Step 3) ===
  const projection = useMemo(() => {
    const registrationFee = includeRegistration ? pricing.registrationFee : 0;
    let tuition = 0;
    let transport = 0;
    let complementary = 0;
    const perStudent = students.map((s, i) => {
      const t = tuitionForLevel(pricing, s.level);
      const tr = s.transportTier ? transportForTier(pricing, s.transportTier as CityTier) : 0;
      // Complementary services pricing (psychology + speech therapy)
      let studentComplementary = 0;
      const psychologyService = pricing.complementaryServices.find((c) => c.qualifier === "psychology");
      const speechService = pricing.complementaryServices.find((c) => c.qualifier === "speech_therapy");
      if (s.psychologyMode && psychologyService) {
        studentComplementary += s.psychologyMode === "annual"
          ? psychologyService.annualAmount
          : psychologyService.semesterAmount;
      }
      if (s.speechTherapyMode && speechService) {
        studentComplementary += s.speechTherapyMode === "annual"
          ? speechService.annualAmount
          : speechService.semesterAmount;
      }
      // Clubs — use additionalServices lookup, fallback to 5,000 DA each
      let clubTotal = 0;
      for (const cq of s.clubs) {
        const svc = pricing.additionalServices.find((a) => a.qualifier === cq);
        clubTotal += svc?.amount ?? 5000;
      }
      studentComplementary += clubTotal;
      tuition += t;
      transport += tr;
      complementary += studentComplementary;
      return {
        index: i + 1,
        name: s.firstName.trim() || `Élève ${i + 1}`,
        level: LEVEL_LABELS_FR[s.level],
        tuition: t,
        transport: tr,
        complementary: studentComplementary,
        tranches: tuitionTranches(t),
      };
    });
    const subtotal = registrationFee + tuition + transport + complementary;
    // Sibling discount: −5,000 DA per additional child
    const siblingDiscount = students.length > 1 ? (students.length - 1) * 5000 : 0;
    const grandTotal = Math.max(0, subtotal - siblingDiscount);
    // Full-annual alternative (10% off tuition + transport)
    const annualDiscounted = Math.round((tuition + transport) * 0.9) + registrationFee + complementary;
    return {
      perStudent,
      registrationFee,
      totalTuition: tuition,
      totalTransport: transport,
      totalComplementary: complementary,
      siblingDiscount,
      grandTotal,
      annualDiscounted,
      annualSavings: (tuition + transport + registrationFee + complementary) - annualDiscounted,
    };
  }, [students, pricing, includeRegistration]);

  async function handleDownloadQuote() {
    const input: QuotationInput = {
      parentName: parentName.trim() || "Prospect (à renseigner)",
      parentPhone: parentPhone || undefined,
      students: projection.perStudent.map((s) => ({
        name: s.name,
        level: s.level,
        tuition: s.tuition,
        transport: s.transport,
        tranches: s.tranches,
      })),
      registrationFee: projection.registrationFee,
      totalTuition: projection.totalTuition,
      totalTransport: projection.totalTransport,
      grandTotal: projection.grandTotal,
      discountNote: projection.siblingDiscount > 0
        ? `Remise fratrie: -${formatDzdPlain(projection.siblingDiscount)} DA`
        : undefined,
    };
    try {
      const pdfBytes = await generateQuotationPdf(input);
      const fileName = `simulation-${parentName || "prospect"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadPdf(pdfBytes, fileName);
      toast.showSuccess("Simulation exportée", fileName);
    } catch (e) {
      toast.showError("Échec", e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <UnifiedModal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      variant="dialog"
      icon={Calculator}
      iconTone="primary"
      title="Simulateur de Devis & Programme"
      description="Projection des coûts pour un parent prospect — aucune donnée enregistrée (spec §2.2)"
      footer={
        <>
          <Button variant="outline" onClick={handleDownloadQuote}>
            <Download className="h-4 w-4" /> Exporter PDF
          </Button>
          <div className="flex-1" />
          {onStartRegistration && (
            <Button onClick={() => { onOpenChange(false); onStartRegistration(); }}>
              Lancer l'inscription <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {/* Parent (prospect) info */}
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="Nom du parent (prospect)" hint="Optionnel — pour l'export PDF">
            <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Ex. Famille Benali" />
          </FormField>
          <FormField label="Téléphone">
            <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="0561 XX XX XX" />
          </FormField>
        </div>

        <Separator />

        {/* Students configuration */}
        <div className="space-y-3">
          {students.map((s, i) => (
            <div key={i} className="rounded-md border border-border p-3 space-y-3 relative">
              <div className="flex items-center justify-between">
                <Badge variant="default">Élève {i + 1}</Badge>
                {students.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-status-danger" onClick={() => removeStudent(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <FormField label="Prénom (optionnel)">
                  <Input value={s.firstName} onChange={(e) => update(i, { firstName: e.target.value })} placeholder={`Élève ${i + 1}`} />
                </FormField>
                <FormField label="Niveau">
                  <Select value={s.level} onValueChange={(v) => update(i, { level: v as AcademicLevel, gradeYear: 1 })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primaire">Primaire</SelectItem>
                      <SelectItem value="cem">CEM</SelectItem>
                      <SelectItem value="lycee">Lycée</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Année">
                  <Select value={String(s.gradeYear)} onValueChange={(v) => update(i, { gradeYear: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: LEVEL_YEARS[s.level] }, (_, k) => k + 1).map((y) => (
                        <SelectItem key={y} value={String(y)}>Année {y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Transport">
                  <Select value={s.transportTier} onValueChange={(v) => update(i, { transportTier: v as CityTier })}>
                    <SelectTrigger><SelectValue placeholder="Sans" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sans transport</SelectItem>
                      <SelectItem value="t1">Zone urbaine (T1)</SelectItem>
                      <SelectItem value="t2">Zone périurbaine (T2)</SelectItem>
                      <SelectItem value="t3">Zone rurale (T3)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Psychologie">
                  <Select value={s.psychologyMode ?? "__none__"} onValueChange={(v) => update(i, { psychologyMode: v === "__none__" ? null : v as "semester" | "annual" })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Aucune —</SelectItem>
                      <SelectItem value="semester">Semestre</SelectItem>
                      <SelectItem value="annual">Année</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Orthophonie">
                  <Select value={s.speechTherapyMode ?? "__none__"} onValueChange={(v) => update(i, { speechTherapyMode: v === "__none__" ? null : v as "semester" | "annual" })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Aucune —</SelectItem>
                      <SelectItem value="semester">Semestre</SelectItem>
                      <SelectItem value="annual">Année</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              {/* Clubs */}
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">Clubs</p>
                <div className="flex flex-wrap gap-1.5">
                  {CLUB_OPTIONS.map((c) => {
                    const active = s.clubs.includes(c.qualifier);
                    return (
                      <button
                        key={c.qualifier}
                        type="button"
                        onClick={() => toggleClub(i, c.qualifier)}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                          active ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={addStudent}>
            <Plus className="h-4 w-4" /> Ajouter un enfant
          </Button>
        </div>

        <Separator />

        {/* Registration fee toggle */}
        <label className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/5">
          <input type="checkbox" checked={includeRegistration} onChange={(e) => setIncludeRegistration(e.target.checked)} className="h-4 w-4" />
          <div>
            <p className="text-sm font-medium">Frais d'inscription</p>
            <p className="text-xs text-muted-foreground">Facturé une fois à l'inscription</p>
          </div>
          <span className="ml-auto font-mono text-sm">{formatDzd(projection.registrationFee)}</span>
        </label>

        {/* === Projection results === */}
        <div className="rounded-md border border-status-info/30 bg-status-info/5 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-status-info flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Projection des coûts
          </p>

          {/* Per-student breakdown */}
          <div className="space-y-2">
            {projection.perStudent.map((s) => (
              <div key={s.index} className="rounded-md border border-border bg-background p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.name} <span className="text-muted-foreground">· {s.level}</span></span>
                  <span className="font-mono font-semibold">{formatDzd(s.tuition + s.transport + s.complementary)}</span>
                </div>
                <div className="pl-2 mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Scolarité (3 tranches)</span><span className="font-mono">{formatDzd(s.tuition)}</span></div>
                  {s.transport > 0 && <div className="flex justify-between"><span>Transport</span><span className="font-mono">{formatDzd(s.transport)}</span></div>}
                  {s.complementary > 0 && <div className="flex justify-between"><span>Services complémentaires</span><span className="font-mono">{formatDzd(s.complementary)}</span></div>}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Totals */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Frais d'inscription</span><span className="font-mono">{formatDzdPlain(projection.registrationFee)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total scolarité</span><span className="font-mono">{formatDzdPlain(projection.totalTuition)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total transport</span><span className="font-mono">{formatDzdPlain(projection.totalTransport)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Services complémentaires</span><span className="font-mono">{formatDzdPlain(projection.totalComplementary)}</span></div>
            {projection.siblingDiscount > 0 && (
              <div className="flex justify-between text-status-success"><span>Remise fratrie</span><span className="font-mono">−{formatDzdPlain(projection.siblingDiscount)}</span></div>
            )}
          </div>

          <Separator />

          {/* Grand total + annual alternative */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border p-3 bg-background">
              <p className="text-[10px] uppercase text-muted-foreground">Total (par tranches)</p>
              <p className="text-lg font-mono font-bold text-primary">{formatDzd(projection.grandTotal)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">3 échéances · T1=S1 Sept–Nov, etc.</p>
            </div>
            <div className="rounded-md border border-status-success/40 bg-status-success/5 p-3">
              <p className="text-[10px] uppercase text-status-success">Annuel complet (−10%)</p>
              <p className="text-lg font-mono font-bold text-status-success">{formatDzd(projection.annualDiscounted)}</p>
              <p className="text-[10px] text-status-success mt-0.5">Économie: {formatDzdPlain(projection.annualSavings)} DZD</p>
            </div>
          </div>
        </div>
      </div>
    </UnifiedModal>
  );
}
