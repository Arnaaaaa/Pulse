const nodemailer = require("nodemailer");
const { escapeHtml } = require("./helpers");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT) || 2525;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  // If Mailtrap creds missing, fallback to console-only (dev without SMTP)
  if (!host || !user || !pass || user.includes("your_mailtrap")) {
    console.warn("[mailer] MAIL_HOST/USER/PASS not configured (check .env / config.env). OTP will be logged to console only.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    auth: { user, pass },
    // Fail fast instead of leaving the client waiting when the SMTP port is unreachable
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  // Verify in background
  transporter.verify((err) => {
    if (err) console.error("[mailer] SMTP verify failed:", err.message);
    else console.log("[mailer] SMTP ready via", host + ":" + port);
  });

  return transporter;
}

// '"PULSE" <me@gmail.com>' (or, leniently, '"PULSE" me@gmail.com') -> { name: "PULSE", email: "me@gmail.com" }
function parseAddress(value) {
  const email = (/[^\s<>"]+@[^\s<>"]+/.exec(value) || [value.trim()])[0];
  const name = value.replace(email, "").replace(/[<>"]/g, "").trim();
  return name ? { name, email } : { email };
}

// Brevo's HTTPS API (port 443) — used when BREVO_API_KEY is set, e.g. on hosts that block outbound SMTP
async function sendViaBrevo({ from, toEmail, toName, subject, text, html }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseAddress(from),
      to: [{ email: toEmail, ...(toName ? { name: toName } : {}) }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${body.message || body.code || "request failed"}`);
  return body.messageId;
}

async function sendOTPEmail(toEmail, toName, code, purpose) {
  const subjectMap = {
    new_user: "Your PULSE verification code",
    login: "Your PULSE login code",
    forgot: "Your PULSE password reset code",
    change: "Your PULSE password change code",
  };
  const subject = subjectMap[purpose] || "Your PULSE verification code";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #eee;border-radius:8px;padding:24px">
      <h2 style="color:#4C5FD5;margin:0 0 12px">PULSE</h2>
      <p>Hi ${escapeHtml(toName || "there")},</p>
      <p>Your verification code is:</p>
      <div style="font-size:32px;letter-spacing:6px;font-weight:700;background:#f5f7ff;padding:12px 16px;border-radius:6px;text-align:center;margin:16px 0">${code}</div>
      <p style="color:#666;font-size:13px">This code expires in <b>5 minutes</b>. If you didn't request this, you can ignore this email.</p>
      <p style="color:#999;font-size:12px">Purpose: ${purpose}</p>
    </div>
  `;

  const text = `Hi ${toName || "there"},\nYour PULSE code is: ${code}\nExpires in 5 minutes. Purpose: ${purpose}`;

  const from = process.env.MAIL_FROM || '"PULSE" <no-reply@pulse.io>';

  const isProd = process.env.NODE_ENV === "production";
  // Codes are only ever printed to the server console in development, never returned to the client
  if (!isProd) console.log(`[mailer] OTP for ${toEmail} (${purpose}): ${code}`);

  if (process.env.BREVO_API_KEY) {
    try {
      const messageId = await sendViaBrevo({ from, toEmail, toName, subject, text, html });
      console.log(`[mailer] Email sent via Brevo to ${toEmail} (${purpose}) messageId=${messageId}`);
      return { mocked: false, messageId };
    } catch (err) {
      console.error(`[mailer] Brevo failed to send OTP to ${toEmail}:`, err.message);
      if (!isProd) return { mocked: true, error: err.message };
      throw err;
    }
  }

  const tx = getTransporter();
  if (!tx) {
    if (isProd) throw new Error("SMTP is not configured");
    return { mocked: true };
  }

  try {
    const info = await tx.sendMail({ from, to: toEmail, subject, text, html });
    console.log(`[mailer] Email sent to ${toEmail} (${purpose}) messageId=${info.messageId}`);
    return { mocked: false, messageId: info.messageId };
  } catch (err) {
    console.error(`[mailer] Failed to send OTP to ${toEmail}:`, err.message);
    if (!isProd) {
      console.warn("[mailer] Falling back to console OTP due to send failure");
      return { mocked: true, error: err.message };
    }
    throw err;
  }
}

module.exports = { sendOTPEmail, getTransporter };
