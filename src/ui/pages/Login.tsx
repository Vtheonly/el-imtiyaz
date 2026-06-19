import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { KeyRound, User, AlertCircle, ShieldCheck } from "lucide-react";
import { Button, Card } from "../components/common";
import { DynamicLogo } from "../components/logo/DynamicLogo";
import { setSession } from "../state/slices/session.slice";
import { UserRole } from "../../core/enums";
import toast from "react-hot-toast";

export function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const savedPassword =
        localStorage.getItem("el-imtiyaz:password") || "admin";

      if (username.toLowerCase() === "admin" && password === savedPassword) {
        dispatch(
          setSession({
            isAuthenticated: true,
            role: UserRole.SUPER_ADMIN,
            employeeName: "System Administrator",
            employeeId: "admin-id",
          }),
        );
        toast.success("Welcome back, Administrator!");
        navigate("/dashboard");
      } else {
        toast.error("Invalid username or password.");
      }
      setLoading(false);
    }, 400);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.1fr",
        height: "100vh",
        background: "var(--bg-app)",
        fontFamily: "var(--font-sans)",
        overflow: "hidden",
      }}
    >
      {/* Brand & Particle Logo Presentation */}
      <div
        className="flex flex-col items-center justify-center p-8 text-center"
        style={{
          background: "rgba(30, 31, 32, 0.4)",
          borderRight: "1px solid var(--border-default)",
        }}
      >
        {/* Set to 'logo' mode and target your public image file */}
        <div
          style={{ width: 340, height: 340, marginBottom: "var(--space-6)" }}
        >
          <DynamicLogo
            mode="logo"
            imageUrl="./school-logo.png"
            height={340}
            allowUpload={false}
            showControls={false}
          />
        </div>
        <h1
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: "var(--weight-bold)",
            color: "white",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          El-Imtiyaz School
        </h1>
        <p
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "var(--text-sm)",
            marginTop: 4,
            maxWidth: 320,
          }}
        >
          Professional academic administration, financial reporting, and
          localized ledger synchronization.
        </p>
      </div>

      {/* Auth Entry Form */}
      <div className="flex items-center justify-center p-8">
        <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 400 }}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <ShieldCheck
                  size={20}
                  style={{ color: "var(--color-primary-blue)" }}
                />
                <span>Security Gateway</span>
              </div>
            }
            subtitle="Please authenticate to unlock the local database workspace"
          >
            <div className="flex flex-col gap-4">
              <div>
                <label
                  className="el-stat__label"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Username
                </label>
                <div className="el-input">
                  <User size={14} className="el-input__icon" />
                  <input
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label
                  className="el-stat__label"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Password
                </label>
                <div className="el-input">
                  <KeyRound size={14} className="el-input__icon" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 10,
                  borderRadius: "var(--radius-md)",
                  background: "rgba(52, 155, 212, 0.05)",
                  border: "1px solid var(--border-primary)",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-primary-blue)",
                  marginTop: 6,
                }}
              ></div>

              <Button
                type="submit"
                variant="primary"
                style={{ width: "100%", marginTop: "var(--space-2)" }}
                disabled={loading}
              >
                {loading ? "Authenticating..." : "Unlock Workspace"}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}
