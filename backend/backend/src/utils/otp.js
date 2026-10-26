const crypto = require("crypto");
const { Otp } = require("../models");
const { generateOTP, normalizeEmail, HttpError } = require("./helpers");

const MAX_ATTEMPTS = 5;
const ttlMs = () => (Number(process.env.OTP_EXPIRES_IN_MINUTES) || 5) * 60 * 1000;
const cooldownMs = () => Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60) * 1000;

const hash = (code) => crypto.createHash("sha256").update(String(code).trim()).digest("hex");

// Creates (or replaces) the pending code for this email + purpose. Throws 429 if one was sent too recently.
async function createOTP(email, purpose) {
  email = normalizeEmail(email);
  const existing = await Otp.findOne({ email, purpose });
  if (existing && Date.now() - existing.updatedAt.getTime() < cooldownMs()) {
    throw new HttpError(429, "A code was sent recently. Please wait a minute before requesting another.");
  }
  const code = generateOTP(6);
  await Otp.findOneAndUpdate(
    { email, purpose },
    { codeHash: hash(code), attempts: 0, expiresAt: new Date(Date.now() + ttlMs()) },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return code;
}

async function verifyOTP(email, purpose, code) {
  email = normalizeEmail(email);
  const rec = await Otp.findOne({ email, purpose });
  if (!rec || rec.expiresAt.getTime() < Date.now()) {
    if (rec) await rec.deleteOne();
    return { valid: false, message: "Code expired or not found. Please request a new code." };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    await rec.deleteOne();
    return { valid: false, message: "Too many attempts. Please request a new code." };
  }
  const a = Buffer.from(rec.codeHash, "hex");
  const b = Buffer.from(hash(code), "hex");
  if (!crypto.timingSafeEqual(a, b)) {
    await Otp.updateOne({ _id: rec._id }, { $inc: { attempts: 1 } });
    return { valid: false, message: "Invalid code." };
  }
  // Single use: only the request that actually deletes the record wins
  const { deletedCount } = await Otp.deleteOne({ _id: rec._id });
  if (!deletedCount) return { valid: false, message: "Code already used. Please request a new code." };
  return { valid: true };
}

module.exports = { createOTP, verifyOTP };
