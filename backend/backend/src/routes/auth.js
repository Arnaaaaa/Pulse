const express = require("express");
const bcrypt = require("bcryptjs");
const { User } = require("../models");
const { asyncHandler, HttpError, normalizeEmail, normalizeName } = require("../utils/helpers");
const { createOTP, verifyOTP } = require("../utils/otp");
const { sendOTPEmail } = require("../utils/mailer");
const { issueToken, issueResetToken, userFromToken, requireAuth, optionalAuth } = require("../middleware/auth");
const { createEmployee } = require("./users");

const router = express.Router();

const NO_ACCESS_MSG = "Sorry you dont have access. Contact the system administrator if you think this is a mistake";
const MIN_PASSWORD = 8;

// Name + email must both match an active employee the admin has entered.
async function findEmployee(name, email) {
  if (!name || !email) throw new HttpError(400, "name and email are required");
  const user = await User.findOne({ email: normalizeEmail(email) }).select("+passwordHash +tokenVersion");
  if (!user || !user.active || normalizeName(user.name) !== normalizeName(name)) throw new HttpError(401, NO_ACCESS_MSG);
  return user;
}

function checkPassword(password) {
  if (!password || String(password).length < MIN_PASSWORD) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters`);
  }
}

async function sendCode(user, purpose) {
  const code = await createOTP(user.email, purpose);
  try {
    await sendOTPEmail(user.email, user.name, code, purpose);
  } catch {
    throw new HttpError(500, "Failed to send email. Try again.");
  }
}

async function verifyCode(user, purpose, code) {
  if (!code) throw new HttpError(400, "code is required");
  const result = await verifyOTP(user.email, purpose, code);
  if (!result.valid) throw new HttpError(400, result.message);
}

// Sets the password, revokes all existing sessions and returns a fresh session token.
async function setPassword(user, password) {
  user.passwordHash = await bcrypt.hash(String(password), 10);
  user.isPasswordSet = true;
  user.tokenVersion += 1;
  await user.save();
  return issueToken(user);
}

// Resolves the user a reset token was issued to; the token dies once the password changes (tokenVersion bump).
async function userFromResetToken(req, purpose) {
  const user = await userFromToken(req.body.tempToken, purpose);
  if (!user) throw new HttpError(401, "Invalid or expired reset token");
  return user;
}

// Admin adds an employee (name, email, role). Same as POST /api/users.
router.post("/admin/create-employee", requireAuth, createEmployee);

// ── New employee: name+email → code → set password ─────────────
router.post("/new-user/request-code", asyncHandler(async (req, res) => {
  const user = await findEmployee(req.body.name, req.body.email);
  if (user.isPasswordSet) throw new HttpError(400, "Password already set. Please use regular login (name, email, password).");
  await sendCode(user, "new_user");
  res.json({ ok: true, message: "Code sent to your email. It expires in 5 minutes." });
}));

router.post("/new-user/verify-code", asyncHandler(async (req, res) => {
  const user = await findEmployee(req.body.name, req.body.email);
  if (user.isPasswordSet) throw new HttpError(400, "Password already set. Please use regular login (name, email, password).");
  await verifyCode(user, "new_user", req.body.code);
  res.json({ ok: true, tempToken: issueResetToken(user, "new_user_setup"), message: "Code verified. Please set your password." });
}));

router.post("/new-user/set-password", asyncHandler(async (req, res) => {
  checkPassword(req.body.password);
  const user = await userFromResetToken(req, "new_user_setup");
  if (user.isPasswordSet) throw new HttpError(400, "Password already set. Use login.");
  const token = await setPassword(user, req.body.password);
  res.json({ ok: true, user, token, message: "Password set successfully." });
}));

// ── Existing user: name+email+password → code → session ────────
router.post("/login/request-code", asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!password) throw new HttpError(400, "name, email and password are required");
  const user = await findEmployee(name, email);
  if (!user.isPasswordSet) throw new HttpError(400, "Password not set yet. Please use New User login to set your password.");
  if (!(await bcrypt.compare(String(password), user.passwordHash))) throw new HttpError(401, "Invalid password");
  await sendCode(user, "login");
  res.json({ ok: true, message: "Code sent to email. Expires in 5 minutes." });
}));

router.post("/login/verify-code", asyncHandler(async (req, res) => {
  const user = await findEmployee(req.body.name, req.body.email);
  if (!user.isPasswordSet) throw new HttpError(400, "Password not set yet. Please use New User login to set your password.");
  await verifyCode(user, "login", req.body.code);
  res.json({ ok: true, user, token: issueToken(user), message: "Login successful." });
}));

router.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  // Revokes every session of this user (tokens are stateless, so this is how they are invalidated)
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ ok: true });
}));

// ── Forgot password (logged out) / change password (logged in) ─
// Same procedure: identify → code → tempToken → new password.
// When logged in, the Bearer token identifies the user and name/email are optional.
function passwordResetRoutes(prefix, purpose, resetPurpose) {
  const identify = async (req) => {
    if (req.user) {
      const { name, email } = req.body;
      if (name || email) {
        const claimed = await findEmployee(name, email);
        if (!claimed._id.equals(req.user._id)) throw new HttpError(401, NO_ACCESS_MSG);
      }
      return req.user;
    }
    return findEmployee(req.body.name, req.body.email);
  };

  router.post(`${prefix}/request-code`, optionalAuth, asyncHandler(async (req, res) => {
    const user = await identify(req);
    await sendCode(user, purpose);
    res.json({ ok: true, message: "Code sent to your email. It expires in 5 minutes." });
  }));

  router.post(`${prefix}/verify-code`, optionalAuth, asyncHandler(async (req, res) => {
    const user = await identify(req);
    await verifyCode(user, purpose, req.body.code);
    res.json({ ok: true, tempToken: issueResetToken(user, resetPurpose), message: "Code verified. You can now set a new password." });
  }));

  router.post(`${prefix}/reset`, asyncHandler(async (req, res) => {
    const password = req.body.newPassword ?? req.body.password;
    checkPassword(password);
    const user = await userFromResetToken(req, resetPurpose);
    const token = await setPassword(user, password);
    res.json({ ok: true, user, token, message: "Password updated successfully." });
  }));
}
passwordResetRoutes("/forgot-password", "forgot", "forgot_reset");
passwordResetRoutes("/change-password", "change", "change_reset");

router.get("/me", requireAuth, (req, res) => res.json(req.user));

module.exports = router;
