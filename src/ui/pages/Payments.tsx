import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Search,
  Download,
  RefreshCw,
  BookOpen,
  FileSpreadsheet,
  Plus,
} from "lucide-react";
import { Card, Button, StatBlock, EmptyState } from "../components/common";
import { PageHeader } from "../components/common/PageHeader";
import { DataGrid, Column } from "../components/data/DataGrid";
import { LedgerFormSlider } from "../components/forms/LedgerFormSlider";
import { formatDZD } from "@shared/currency";
import toast from "react-hot-toast";

interface LedgerRow {
  id: string;
  studentName: string;
  level: string;
  classCode: string;
  optionCode: string;
  remise: number;
  justification: string;
  devisAnnuel: number;
  totalVersements: number;
  totalCreance: number;
  grandTotal: number;
  fi: number;
  v2: number;
  altV2: number;
  v3: number;
  destination: string;
  t1: number;
  t2: number;
  t3: number;
  psy1: number;
  psy2: number;
  orth1: number;
  orth2: number;
  ePlant: number;
  ratrapage: number;
  september: number;
  december: number;
  march: number;
  septemberBalance: number;
  infos: string;
  createdAt: string;
}

export function Payments() {
  const [viewMode, setViewMode] = useState<"payments" | "ledger">("ledger");
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [recomputing, setRecomputing] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Sliding Data State
  const [formValues, setFormValues] = useState({
    studentName: "",
    level: "PRIM",
    classCode: "",
    optionCode: "",
    remise: "0",
    justification: "",
    fi: "25000",
    v2: "0",
    altV2: "0",
    v3: "0",
    destination: "",
    t1: "0",
    t2: "0",
    t3: "0",
    psy1: "0",
    psy2: "0",
    orth1: "0",
    orth2: "0",
    ePlant: "0",
    ratrapage: "0",
    september: "0",
    december: "0",
    march: "0",
    septemberBalance: "0",
    infos: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const loadLedger = async () => {
    setLoading(true);
    try {
      const rows = await window.elImtiyaz.ledger.list({ pageSize: 1000 });
      setLedger(
        (rows as any[]).map((e) => ({
          id: e.id.value || e.id,
          studentName: e.studentName,
          level: e.level,
          classCode: e.classCode,
          optionCode: e.optionCode,
          remise: e.remise,
          justification: e.justification || "",
          devisAnnuel: e.devisAnnuel,
          totalVersements: e.totalVersements,
          totalCreance: e.totalCreance,
          grandTotal: e.grandTotal,
          fi: e.fi,
          v2: e.v2,
          altV2: e.altV2,
          v3: e.v3,
          destination: e.destination || "",
          t1: e.t1,
          t2: e.t2,
          t3: e.t3,
          psy1: e.psy1,
          psy2: e.psy2,
          orth1: e.orth1,
          orth2: e.orth2,
          ePlant: e.ePlant,
          ratrapage: e.ratrapage,
          september: e.september,
          december: e.december,
          march: e.march,
          septemberBalance: e.septemberBalance || 0,
          infos: e.infos || "",
          createdAt: e.createdAt,
        })),
      );
    } catch {
      toast.error("Failed to load school ledger rows.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, []);

  const handleFormChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearForm = () => {
    setEditingEntryId(null);
    setFormValues({
      studentName: "",
      level: "PRIM",
      classCode: "",
      optionCode: "",
      remise: "0",
      justification: "",
      fi: "25000",
      v2: "0",
      altV2: "0",
      v3: "0",
      destination: "",
      t1: "0",
      t2: "0",
      t3: "0",
      psy1: "0",
      psy2: "0",
      orth1: "0",
      orth2: "0",
      ePlant: "0",
      ratrapage: "0",
      september: "0",
      december: "0",
      march: "0",
      septemberBalance: "0",
      infos: "",
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const handleSave = async () => {
    if (!formValues.studentName.trim()) {
      toast.error("Pupil name cannot be empty.");
      return;
    }
    const payload = {
      ...formValues,
      remise: parseFloat(formValues.remise) || 0,
      fi: parseFloat(formValues.fi) || 0,
      v2: parseFloat(formValues.v2) || 0,
      altV2: parseFloat(formValues.altV2) || 0,
      v3: parseFloat(formValues.v3) || 0,
      t1: parseFloat(formValues.t1) || 0,
      t2: parseFloat(formValues.t2) || 0,
      t3: parseFloat(formValues.t3) || 0,
      psy1: parseFloat(formValues.psy1) || 0,
      psy2: parseFloat(formValues.psy2) || 0,
      orth1: parseFloat(formValues.orth1) || 0,
      orth2: parseFloat(formValues.orth2) || 0,
      ePlant: parseFloat(formValues.ePlant) || 0,
      ratrapage: parseFloat(formValues.ratrapage) || 0,
      september: parseFloat(formValues.september) || 0,
      december: parseFloat(formValues.december) || 0,
      march: parseFloat(formValues.march) || 0,
      septemberBalance: parseFloat(formValues.septemberBalance) || 0,
    };

    try {
      if (editingEntryId) {
        await window.elImtiyaz.ledger.update(editingEntryId, payload);
        toast.success("Successfully updated entry.");
      } else {
        await window.elImtiyaz.ledger.create(payload as any);
        toast.success("Added student to the master ledger.");
      }
      handleClearForm();
      loadLedger();
    } catch (err) {
      toast.error(`Error saving: ${(err as Error).message}`);
    }
  };

  const handleEditRow = (row: LedgerRow) => {
    setEditingEntryId(row.id);
    setFormValues({
      studentName: row.studentName,
      level: row.level,
      classCode: row.classCode,
      optionCode: row.optionCode,
      remise: String(row.remise),
      justification: row.justification,
      fi: String(row.fi),
      v2: String(row.v2),
      altV2: String(row.altV2),
      v3: String(row.v3),
      destination: row.destination,
      t1: String(row.t1),
      t2: String(row.t2),
      t3: String(row.t3),
      psy1: String(row.psy1),
      psy2: String(row.psy2),
      orth1: String(row.orth1),
      orth2: String(row.orth2),
      ePlant: String(row.ePlant),
      ratrapage: String(row.ratrapage),
      september: String(row.september),
      december: String(row.december),
      march: String(row.march),
      septemberBalance: String(row.septemberBalance),
      infos: row.infos,
      date: row.createdAt?.slice(0, 10) || "",
    });
  };

  const liveTotals = useMemo(() => {
    const remise = parseFloat(formValues.remise) || 0;
    const fi = parseFloat(formValues.fi) || 0;
    const v2 = parseFloat(formValues.v2) || 0;
    const altV2 = parseFloat(formValues.altV2) || 0;
    const v3 = parseFloat(formValues.v3) || 0;
    const t1 = parseFloat(formValues.t1) || 0;
    const t2 = parseFloat(formValues.t2) || 0;
    const t3 = parseFloat(formValues.t3) || 0;

    const baseTuition = 205000;
    const transportBase = formValues.optionCode === "TRNSP" ? 35000 : 0;
    const devisAnnuel = fi + baseTuition + transportBase - remise;
    const totalVersements = fi + v2 + altV2 + v3 + t1 + t2 + t3;

    return {
      devisAnnuel,
      totalVersements,
      totalCreance: devisAnnuel - totalVersements,
      grandTotal:
        totalVersements +
        (parseFloat(formValues.psy1) || 0) +
        (parseFloat(formValues.psy2) || 0) +
        (parseFloat(formValues.orth1) || 0),
    };
  }, [formValues]);

  const columns: Column<LedgerRow>[] = [
    { key: "studentName", header: "NOM", sortable: true },
    { key: "classCode", header: "H (Classe)", sortable: true, width: 80 },
    {
      key: "devisAnnuel",
      header: "L (Devis)",
      align: "right",
      render: (r) => formatDZD(r.devisAnnuel),
    },
    {
      key: "totalVersements",
      header: "P (Versements)",
      align: "right",
      render: (r) => formatDZD(r.totalVersements),
    },
    {
      key: "totalCreance",
      header: "Q (Creance)",
      align: "right",
      render: (r) => formatDZD(r.totalCreance),
    },
    {
      key: "actions",
      header: "",
      width: 120,
      render: (r) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => handleEditRow(r)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (confirm("Delete row?")) {
                await window.elImtiyaz.ledger.delete(r.id);
                loadLedger();
              }
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="el-page">
      <PageHeader
        title="Ledger Management"
        subtitle={`${ledger.length} active logs`}
        actions={
          <Button
            variant="ghost"
            icon={<RefreshCw size={14} />}
            onClick={loadLedger}
          >
            Refresh
          </Button>
        }
      />

      <div
        className="grid"
        style={{
          gridTemplateColumns: "1.2fr 2fr",
          gap: "var(--space-4)",
          marginBottom: "var(--space-4)",
        }}
      >
        <LedgerFormSlider
          liveTotals={liveTotals}
          onValueChange={handleFormChange}
          onClear={handleClearForm}
          onSave={handleSave}
          values={formValues}
        />
        <Card title="Recalculated System Summaries">
          <div
            className="grid"
            style={{ gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}
          >
            <StatBlock
              label="Active Pupil Count"
              value={ledger.length}
              format="number"
            />
            <StatBlock
              label="Outstanding Balance"
              value={ledger.reduce((acc, row) => acc + row.totalCreance, 0)}
              format="currency"
            />
          </div>
        </Card>
      </div>

      <Card>
        <div
          className="el-search-bar"
          style={{ marginBottom: "var(--space-3)" }}
        >
          <Search size={14} />
          <input
            placeholder="Fuzzy find pupil or class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <DataGrid
          columns={columns}
          data={ledger.filter((r) =>
            r.studentName?.toLowerCase().includes(search.toLowerCase()),
          )}
          rowKey={(r) => r.id}
          loading={loading}
        />
      </Card>
    </div>
  );
}
