import React, { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { api } from "../../api/client";
import { Modal } from "../ui/Primitives";

const MIN_PASSWORD = 8;

// Same procedure as Forgot password: email code -> verify -> new password.
// The server signs out every other session, so we swap in the new token it returns.
export function ChangePasswordModal() {
  const { changePasswordOpen, setChangePasswordOpen, currentUser, completeSignIn, showToast } = useApp();

  const [step, setStep] = useState("start"); // "start" | "code" | "password"
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!changePasswordOpen) return;
    setStep("start");
    setCode("");
    setTempToken(null);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  }, [changePasswordOpen]);

  const close = () => setChangePasswordOpen(false);

  const run = async (fn) => {
    setError("");
    setSubmitting(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await api.changeRequestCode();
      setCode("");
      setStep("code");
    });

  const verify = (e) => {
    e.preventDefault();
    if (!code.trim()) return setError("Please enter the code from your email.");
    run(async () => {
      const res = await api.changeVerifyCode(code.trim());
      setTempToken(res.tempToken);
      setStep("password");
    });
  };

  const save = (e) => {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    run(async () => {
      const session = await api.changeReset(tempToken, newPassword);
      await completeSignIn(session, { quiet: true });
      showToast("Password changed. Other devices have been signed out.", "success");
      close();
    });
  };

  return (
    <Modal open={changePasswordOpen} onClose={close} title="Change password" width="440px">
      {error && <div className="auth-alert auth-alert-error" role="alert">{error}</div>}

      {step === "start" && (
        <div>
          <p style={{ fontSize: 13, marginTop: 0 }}>
            We'll email a verification code to <strong>{currentUser?.email}</strong>. You'll then choose a new password.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={sendCode} disabled={submitting}>
              {submitting ? "Sending..." : "Send code"}
            </button>
          </div>
        </div>
      )}

      {step === "code" && (
        <form onSubmit={verify}>
          <div className="auth-alert auth-alert-info">
            <Mail size={14} /> Code sent to {currentUser?.email}. It expires in 5 minutes.
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-code">Verification code</label>
            <input
              id="cp-code"
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <button type="button" className="btn-link" onClick={sendCode} disabled={submitting}>Resend code</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Verifying..." : "Verify code"}
            </button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={save}>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-new">New password</label>
            <input
              id="cp-new"
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
            <label className="form-label" htmlFor="cp-confirm">Confirm password</label>
            <input
              id="cp-confirm"
              type="password"
              className="form-input"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={close}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Change password"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
