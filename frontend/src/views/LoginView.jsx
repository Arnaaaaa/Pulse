import React, { useState } from "react";
import { Layers, ArrowRight, ArrowLeft, Sun, Moon, CheckCircle2, Mail } from "lucide-react";
import { useApp } from "../context/AppContext";
import { api } from "../api/client";

// Three flows, all confirmed by a code sent to the employee's email:
// - Sign in:          name + email + password -> code -> signed in
// - First time here?: name + email -> code -> choose password -> signed in
// - Forgot password:  name + email -> code -> choose new password -> signed in
const MODES = {
  login: { tab: "Sign In", intro: "Enter your name, work email and password. We'll email you a sign-in code." },
  new: { tab: "First time here?", intro: "Enter your name and work email exactly as your administrator registered them. We'll email you a code so you can set your password." },
  forgot: { tab: "Forgot password", intro: "Enter your name and work email. We'll email you a code so you can choose a new password." },
};

const MIN_PASSWORD = 8;

export function LoginView() {
  const { theme, toggleTheme, completeSignIn } = useApp();

  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("details"); // "details" | "code" | "password"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tempToken, setTempToken] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const switchMode = (next) => {
    setMode(next);
    setStep("details");
    setPassword("");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setTempToken(null);
    setErrorMsg("");
    setInfoMsg("");
  };

  // Runs an API step with shared loading/error handling
  const run = async (fn) => {
    setErrorMsg("");
    setSubmitting(true);
    try {
      await fn();
    } catch (err) {
      setErrorMsg(
        err.message === "Failed to fetch"
          ? "Cannot reach the server. Make sure the backend is running on port 4000."
          : err.message || "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requestCode = () =>
    run(async () => {
      if (mode === "login") await api.loginRequestCode(name, email, password);
      else if (mode === "new") await api.newUserRequestCode(name, email);
      else await api.forgotRequestCode(name, email);
      setCode("");
      setStep("code");
      setInfoMsg(`We sent a 6-digit code to ${email.trim()}. It expires in 5 minutes.`);
    });

  const handleDetails = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || (mode === "login" && !password)) {
      setErrorMsg(mode === "login" ? "Please enter your name, email and password." : "Please enter your name and email.");
      return;
    }
    requestCode();
  };

  const handleCode = (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg("Please enter the code from your email.");
      return;
    }
    run(async () => {
      if (mode === "login") {
        const session = await api.loginVerifyCode(name, email, code.trim());
        await completeSignIn(session);
        return;
      }
      const res = mode === "new"
        ? await api.newUserVerifyCode(name, email, code.trim())
        : await api.forgotVerifyCode(name, email, code.trim());
      setTempToken(res.tempToken);
      setStep("password");
      setInfoMsg("Code verified. Choose your password.");
    });
  };

  const handlePassword = (e) => {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD) {
      setErrorMsg(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    run(async () => {
      const session = mode === "new"
        ? await api.newUserSetPassword(tempToken, newPassword)
        : await api.forgotReset(tempToken, newPassword);
      await completeSignIn(session);
    });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-hero">
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="brand-logo">
                  <Layers size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>PULSE</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Project Updates, Logistics &amp; Scheduling Engine
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn-sm"
                onClick={toggleTheme}
                title="Toggle Dark/Light Mode"
              >
                {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
              </button>
            </div>

            <h2 style={{ marginTop: 32, fontSize: 24, lineHeight: 1.3 }}>
              Plan sprints, track dependencies, and ship projects on time.
            </h2>
            <p style={{ opacity: 0.8, fontSize: 13.5, marginTop: 12 }}>
              Role-based workspaces for Admins, Project Managers, and Team Members — complete with Kanban boards, Gantt timelines, bug triage, risk matrices, and review workflows.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, opacity: 0.85 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color="#22c55e" />
              <span>Role-Based Access Control (Admin, Project Manager, Team Member)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color="#22c55e" />
              <span>Review & Approval Workflow before Task Completion</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color="#22c55e" />
              <span>Email verification codes on every sign-in</span>
            </div>
          </div>
        </div>

        <div className="auth-form-pane">
          <div className="tabs-bar" style={{ marginBottom: 16 }}>
            {Object.entries(MODES).map(([key, m]) => (
              <button
                key={key}
                type="button"
                className={`tab-btn ${mode === key ? "active" : ""}`}
                onClick={() => switchMode(key)}
                disabled={submitting}
              >
                {m.tab}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="auth-alert auth-alert-error" role="alert">
              {errorMsg}
            </div>
          )}
          {infoMsg && !errorMsg && step !== "details" && (
            <div className="auth-alert auth-alert-info">
              <Mail size={14} /> {infoMsg}
            </div>
          )}

          {step === "details" && (
            <form onSubmit={handleDetails}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>{MODES[mode].intro}</p>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  type="text"
                  className="form-input"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-email">Work email</label>
                <input
                  id="auth-email"
                  type="email"
                  className="form-input"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {mode === "login" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    className="form-input"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={submitting}>
                {submitting ? "Sending code..." : "Send code"} <ArrowRight size={14} />
              </button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleCode}>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-code">Verification code</label>
                <input
                  id="auth-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="form-input"
                  style={{ letterSpacing: "0.3em", fontSize: 18, textAlign: "center" }}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={submitting}>
                {submitting ? "Verifying..." : mode === "login" ? "Verify & sign in" : "Verify code"} <ArrowRight size={14} />
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                <button type="button" className="btn-link" onClick={() => switchMode(mode)} disabled={submitting}>
                  <ArrowLeft size={13} /> Back
                </button>
                <button type="button" className="btn-link" onClick={requestCode} disabled={submitting}>
                  Resend code
                </button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handlePassword}>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-new-password">
                  {mode === "new" ? "Choose a password" : "New password"}
                </label>
                <input
                  id="auth-new-password"
                  type="password"
                  className="form-input"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>At least {MIN_PASSWORD} characters.</span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-confirm-password">Confirm password</label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  className="form-input"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={submitting}>
                {submitting ? "Saving..." : "Save password & sign in"} <ArrowRight size={14} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
