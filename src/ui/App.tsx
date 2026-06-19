import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { CommandPalette } from "./components/layout/CommandPalette";
import { GlobalSearch } from "./components/search/GlobalSearch";
import { LoadingScreen } from "./pages/LoadingScreen";
import { Login } from "./pages/Login";

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

import type { RootState } from "./state/store";

export function App() {
  const navigate = useNavigate();
  const [booting, setBooting] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const isAuthenticated = useSelector(
    (state: RootState) => state.session.isAuthenticated,
  );

  // Global Keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }
      if (isMod && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Sync menu commands
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
    return () => void unsubscribe();
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
          background: "#242526",
          color: "#eff2f3",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <h2>Electron Environment Not Detected</h2>
        <p style={{ color: "#b0bac0", marginTop: 10 }}>
          Please run this application using native Electron scripts via:{" "}
          <code style={{ background: "rgba(0,0,0,0.3)", padding: "4px 8px" }}>
            npm start
          </code>
        </p>
      </div>
    );
  }

  if (booting) {
    return <LoadingScreen onReady={() => setBooting(false)} />;
  }

  // Route guarding check
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
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
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
