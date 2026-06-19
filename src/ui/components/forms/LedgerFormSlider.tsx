import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calculator,
  Check,
  RotateCcw,
} from "lucide-react";
import { Button, Badge } from "../common";
import { formatDZD } from "@shared/currency";

interface LedgerFormSliderProps {
  initialData?: any;
  liveTotals: {
    devisAnnuel: number;
    totalVersements: number;
    totalCreance: number;
    grandTotal: number;
  };
  onValueChange: (field: string, val: string) => void;
  onClear: () => void;
  onSave: () => void;
  values: {
    studentName: string;
    level: string;
    classCode: string;
    optionCode: string;
    remise: string;
    justification: string;
    fi: string;
    v2: string;
    altV2: string;
    v3: string;
    destination: string;
    t1: string;
    t2: string;
    t3: string;
    psy1: string;
    psy2: string;
    orth1: string;
    orth2: string;
    ePlant: string;
    ratrapage: string;
    september: string;
    december: string;
    march: string;
    septemberBalance: string;
    infos: string;
    date: string;
  };
}

export function LedgerFormSlider({
  initialData,
  liveTotals,
  onValueChange,
  onClear,
  onSave,
  values,
}: LedgerFormSliderProps) {
  const [step, setStep] = useState(1);
  const steps = [
    { num: 1, label: "Pupil & Details" },
    { num: 2, label: "Core Installments" },
    { num: 3, label: "Transport Logs" },
    { num: 4, label: "Clinical & Extras" },
  ];

  const handleNext = () => setStep((s) => Math.min(s + 1, 4));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div
      className="el-card flex flex-col gap-4"
      style={{ border: "1px solid var(--border-primary)" }}
    >
      {/* Wizard Progress Slider */}
      <div
        className="flex items-center justify-between"
        style={{
          paddingBottom: 10,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {steps.map((st) => (
            <div key={st.num} className="flex items-center gap-1">
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  background:
                    step === st.num
                      ? "var(--color-primary-blue)"
                      : "var(--color-slate-gray)",
                  color: "white",
                }}
              >
                {st.num}
              </span>
              {step === st.num && (
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--weight-semibold)",
                    color: "var(--color-primary-blue)",
                  }}
                >
                  {st.label}
                </span>
              )}
            </div>
          ))}
        </div>
        <Badge tone={liveTotals.totalCreance > 0 ? "warning" : "success"}>
          Creance: {formatDZD(liveTotals.totalCreance)}
        </Badge>
      </div>

      {/* Part 1: Pupil Classification */}
      {step === 1 && (
        <div
          className="grid"
          style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
        >
          <div>
            <label className="el-stat__label">NOM (F)</label>
            <input
              className="el-input w-full"
              value={values.studentName}
              onChange={(e) => onValueChange("studentName", e.target.value)}
              placeholder="Student Name"
            />
          </div>
          <div>
            <label className="el-stat__label">Niveau (G)</label>
            <select
              className="el-input w-full"
              value={values.level}
              onChange={(e) => onValueChange("level", e.target.value)}
            >
              <option value="PRIM">PRIM</option>
              <option value="COLG">COLG</option>
              <option value="LYC">LYC</option>
              <option value="GS">GS</option>
              <option value="AUTISTE">AUTISTE</option>
            </select>
          </div>
          <div>
            <label className="el-stat__label">CLASSE (H)</label>
            <input
              className="el-input w-full"
              value={values.classCode}
              onChange={(e) => onValueChange("classCode", e.target.value)}
              placeholder="CE1, CM2 etc"
            />
          </div>
          <div>
            <label className="el-stat__label">Option (I)</label>
            <input
              className="el-input w-full"
              value={values.optionCode}
              onChange={(e) => onValueChange("optionCode", e.target.value)}
              placeholder="TRNSP, etc."
            />
          </div>
        </div>
      )}

      {/* Part 2: Core Installments & Remise */}
      {step === 2 && (
        <div
          className="grid"
          style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
        >
          <div>
            <label className="el-stat__label">REMISE (J)</label>
            <input
              type="number"
              className="el-input w-full"
              value={values.remise}
              onChange={(e) => onValueChange("remise", e.target.value)}
            />
          </div>
          <div>
            <label className="el-stat__label">Justification (K)</label>
            <input
              className="el-input w-full"
              value={values.justification}
              onChange={(e) => onValueChange("justification", e.target.value)}
            />
          </div>
          <div>
            <label className="el-stat__label">FI Paid (R)</label>
            <input
              type="number"
              className="el-input w-full"
              value={values.fi}
              onChange={(e) => onValueChange("fi", e.target.value)}
            />
          </div>
          <div>
            <label className="el-stat__label">V2 (S)</label>
            <input
              type="number"
              className="el-input w-full"
              value={values.v2}
              onChange={(e) => onValueChange("v2", e.target.value)}
            />
          </div>
          <div>
            <label className="el-stat__label">2V (T)</label>
            <input
              type="number"
              className="el-input w-full"
              value={values.altV2}
              onChange={(e) => onValueChange("altV2", e.target.value)}
            />
          </div>
          <div>
            <label className="el-stat__label">v3 (U)</label>
            <input
              type="number"
              className="el-input w-full"
              value={values.v3}
              onChange={(e) => onValueChange("v3", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Part 3: Transportation details */}
      {step === 3 && (
        <div
          className="grid"
          style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
        >
          <div>
            <label className="el-stat__label">Destination (V)</label>
            <input
              className="el-input w-full"
              value={values.destination}
              onChange={(e) => onValueChange("destination", e.target.value)}
            />
          </div>
          <div>
            <label className="el-stat__label">Transport T1 (W)</label>
            <input
              type="number"
              className="el-input w-full"
              value={values.t1}
              onChange={(e) => onValueChange("t1", e.target.value)}
            />
          </div>
          <div>
            <label className="el-stat__label">Transport T2 (X)</label>
            <input
              type="number"
              className="el-input w-full"
              value={values.t2}
              onChange={(e) => onValueChange("t2", e.target.value)}
            />
          </div>
          <div>
            <label className="el-stat__label">Transport t3 (Y)</label>
            <input
              type="number"
              className="el-input w-full"
              value={values.t3}
              onChange={(e) => onValueChange("t3", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Part 4: Clinical Tracking & Extras */}
      {step === 4 && (
        <div
          className="grid"
          style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}
        >
          <div>
            <label className="el-stat__label">Psy (1/2)</label>
            <div className="flex gap-1">
              <input
                type="number"
                className="el-input flex-1"
                value={values.psy1}
                onChange={(e) => onValueChange("psy1", e.target.value)}
              />
              <input
                type="number"
                className="el-input flex-1"
                value={values.psy2}
                onChange={(e) => onValueChange("psy2", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="el-stat__label">Orth (1/2)</label>
            <div className="flex gap-1">
              <input
                type="number"
                className="el-input flex-1"
                value={values.orth1}
                onChange={(e) => onValueChange("orth1", e.target.value)}
              />
              <input
                type="number"
                className="el-input flex-1"
                value={values.orth2}
                onChange={(e) => onValueChange("orth2", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="el-stat__label">E-Plant & Ratrapage</label>
            <div className="flex gap-1">
              <input
                type="number"
                className="el-input flex-1"
                value={values.ePlant}
                onChange={(e) => onValueChange("ePlant", e.target.value)}
              />
              <input
                type="number"
                className="el-input flex-1"
                value={values.ratrapage}
                onChange={(e) => onValueChange("ratrapage", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="el-stat__label">September Balance (AG)</label>
            <input
              type="number"
              className="el-input w-full"
              value={values.septemberBalance}
              onChange={(e) =>
                onValueChange("septemberBalance", e.target.value)
              }
            />
          </div>
        </div>
      )}

      {/* Reactive calculations */}
      <div
        className="flex justify-between items-center mt-3"
        style={{
          padding: 8,
          background: "rgba(52,155,212,0.05)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div style={{ fontSize: "var(--text-xs)", display: "flex", gap: 12 }}>
          <span>
            <strong>Devis:</strong> {formatDZD(liveTotals.devisAnnuel)}
          </span>
          <span>
            <strong>Versements:</strong> {formatDZD(liveTotals.totalVersements)}
          </span>
          <span>
            <strong>Grand Total:</strong> {formatDZD(liveTotals.grandTotal)}
          </span>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between mt-2">
        <Button
          size="sm"
          variant="ghost"
          icon={<RotateCcw size={12} />}
          onClick={onClear}
        >
          Clear
        </Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button
              size="sm"
              variant="ghost"
              icon={<ChevronLeft size={12} />}
              onClick={handlePrev}
            >
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button size="sm" variant="ghost" onClick={handleNext}>
              Next <ChevronRight size={12} />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              icon={<Check size={12} />}
              onClick={onSave}
            >
              Save Row
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
