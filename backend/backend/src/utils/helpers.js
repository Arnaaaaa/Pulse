const crypto = require("crypto");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Express 4 does not forward rejected promises to the error handler; this does.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

// Keeps only `fields` of each client-sent array item, and reuses its `id` when it is a real one
// so replacing an array (e.g. milestones) does not give every item a new id.
function subdocs(items, fields) {
  if (!Array.isArray(items)) return undefined;
  return items.map((x) => ({ ...pick(x, fields), ...(/^[a-f\d]{24}$/i.test(x?.id) ? { _id: x.id } : {}) }));
}

function generateOTP(length = 6) {
  let otp = "";
  for (let i = 0; i < length; i++) otp += crypto.randomInt(0, 10);
  return otp;
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function normalizeName(name) {
  return String(name).trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { HttpError, asyncHandler, pick, subdocs, generateOTP, normalizeEmail, normalizeName, escapeHtml, escapeRegex };
