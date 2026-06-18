/**
 * App — root component. Handles routing, global UI state (command palette,
 * global search, loading screen), and menu-command subscriptions.
 */

import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { CommandPalette } from "./components/layout/CommandPalette";
import { GlobalSearch } from "./components/search/GlobalSearch";
import { LoadingScreen } from "./pages/LoadingScreen";

import { Dashboard } from "./pages/Dashboard";
import { Students } from "./pages/Students";
import { StudentProfile } from "./pages/StudentProfile";
import { Payments } from "./pages/Payments";
import { DebtDashboard } from "./pages/DebtDashboard";
import { Classes } from "./pages/Classes";
import { Parents } from "./pages/Parents";
import { Employees } from "./pages/Employees";
import { Attendance } from "./pages/Attendance";
import { AcademicYears } from "./pages/AcademicYears";
import { Reports } from "./pages/Reports";
import { Receipts } from "./pages/Receipts";
import { AuditLogs } from "./pages/AuditLogs";
import { Settings } from "./pages/Settings";
import { Workflows } from "./pages/Workflows";
import { WorkflowEditor } from "./pages/WorkflowEditor";
import { Notifications } from "./pages/Notifications";
import { FeeTemplates } from "./pages/FeeTemplates";
import { Scholarships } from "./pages/Scholarships";

export function App() {
  const navigate = useNavigate();
  const [booting, setBooting] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+K → command palette
      if (isMod && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }

      // Cmd+Shift+F → global search
      if (isMod && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Subscribe to menu commands from the Electron main process
  useEffect(() => {
    if (!window.elImtiyaz) return;
    const unsubscribe = window.elImtiyaz.onMenuCommand((cmd) => {
      if (cmd.id === "navigate" && typeof cmd.payload === "string") {
        navigate(cmd.payload);
      } else if (cmd.id === "command-palette:open") {
        setCommandPaletteOpen(true);
      } else if (cmd.id === "search:open") {
        setSearchOpen(true);
      }
    });
    return unsubscribe;
  }, [navigate]);

  if (!window.elImtiyaz) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-app, #242526)",
          color: "var(--color-text-primary, #eff2f3)",
          fontFamily: "var(--font-sans, sans-serif)",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: "10px" }}>
          Electron Shell Environment Not Detected
        </h2>
        <p
          style={{
            color: "var(--color-text-secondary, #b0bac0)",
            maxWidth: "500px",
            fontSize: "14px",
            lineHeight: "1.6",
          }}
        >
          This application requires Electron to interact with the local SQLite
          database. If you are on Linux, please start the app with sandbox
          checks disabled using:
        </p>
        <div
          style={{
            marginTop: "20px",
            background: "rgba(0,0,0,0.3)",
            padding: "10px 15px",
            borderRadius: "6px",
            fontFamily: "monospace",
            fontSize: "13px",
          }}
        >
          npm start
        </div>
      </div>
    );
  }

  if (booting) {
    return <LoadingScreen onReady={() => setBooting(false)} />;
  }

  return (
    <div className="flex h-full">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
        <TopBar
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <main style={{ flex: 1, overflow: "hidden" }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentProfile />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/payments/:id" element={<Payments />} />
            <Route path="/debt" element={<DebtDashboard />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/parents" element={<Parents />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/academic-years" element={<AcademicYears />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="/audit" element={<AuditLogs />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/workflows/:id/edit" element={<WorkflowEditor />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/fee-templates" element={<FeeTemplates />} />
            <Route path="/scholarships" element={<Scholarships />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
