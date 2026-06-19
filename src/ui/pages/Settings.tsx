import React, { useState } from "react";
import { Save, ShieldAlert, KeyRound, Database, FileDown } from "lucide-react";
import { Card, Button, Badge, StatBlock } from "../components/common";
import { PageHeader } from "../components/common/PageHeader";
import { PALETTE } from "@shared/constants";
import toast from "react-hot-toast";

export function Settings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [backing, setBacking] = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);

  const handleBackup = async () => {
    setBacking(true);
    try {
      const result = await window.elImtiyaz.system.backup();
      setBackupResult((result as any).path);
      toast.success("Database backed up successfully.");
    } catch (err) {
      setBackupResult(`Backup failed: ${(err as Error).message}`);
      toast.error("Failed to generate backup.");
    } finally {
      setBacking(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPassword =
      localStorage.getItem("el-imtiyaz:password") || "admin";

    if (currentPassword !== savedPassword) {
      toast.error("Current password verification failed.");
      return;
    }
    if (!newPassword.trim()) {
      toast.error("New password cannot be blank.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Password confirmation match error.");
      return;
    }

    localStorage.setItem("el-imtiyaz:password", newPassword);
    toast.success("Security password updated successfully!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="el-page">
      <PageHeader
        title="System Settings"
        subtitle="Configure system parameters and security controls"
      />

      <div className="flex flex-col gap-4">
        {/* Security Password Panel */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <KeyRound
                size={18}
                style={{ color: "var(--color-primary-blue)" }}
              />
              <span>Change Security Password</span>
            </div>
          }
          subtitle="Update the local administrative password used at startup"
        >
          <form
            onSubmit={handleChangePassword}
            className="grid"
            style={{
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "var(--space-3)",
            }}
          >
            <div>
              <label className="el-stat__label">Current Password</label>
              <input
                type="password"
                className="el-input w-full"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Verify existing password"
              />
            </div>
            <div>
              <label className="el-stat__label">New Password</label>
              <input
                type="password"
                className="el-input w-full"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose strong password"
              />
            </div>
            <div className="flex items-end gap-2">
              <div style={{ flex: 1 }}>
                <label className="el-stat__label">Confirm New Password</label>
                <input
                  type="password"
                  className="el-input w-full"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                />
              </div>
              <Button type="submit" variant="primary">
                Update
              </Button>
            </div>
          </form>
        </Card>

        {/* Database & Backups Panel */}
        <Card
          title="Database Maintenance & Backups"
          subtitle="Generate instant snapshots of your school database files"
        >
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div>
                <div style={{ fontWeight: "var(--weight-medium)" }}>
                  Generate Database Snapshot
                </div>
                <div
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-tertiary)",
                    marginTop: 2,
                  }}
                >
                  Exports a timestamped copy of your SQLite database inside the
                  OS directory.
                </div>
              </div>
              <Button
                variant="primary"
                icon={<Database size={14} />}
                onClick={handleBackup}
                disabled={backing}
              >
                {backing ? "Backing up..." : "Backup Now"}
              </Button>
            </div>

            {backupResult && (
              <div
                style={{
                  padding: 10,
                  background: "var(--color-primary-tint-08)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-primary)",
                  fontSize: "var(--text-xs)",
                }}
              >
                <span
                  style={{
                    color: "var(--color-primary-blue)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {backupResult}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Brand palette info */}
        <Card
          title="System Theme Details"
          subtitle="Active academic design tokens"
        >
          <div className="flex flex-wrap gap-2">
            {Object.entries(PALETTE)
              .filter(([k]) => !k.includes("RGB") && !k.includes("TINT"))
              .map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 8,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      background: value as string,
                      borderRadius: "var(--radius-xs)",
                      border: "1px solid var(--border-default)",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--color-text-secondary)",
                        fontWeight: "var(--weight-semibold)",
                      }}
                    >
                      {key}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--color-text-tertiary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
