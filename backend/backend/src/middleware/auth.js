const jwt = require("jsonwebtoken");
const { User } = require("../models");

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

// Session tokens carry no `purpose`; short-lived reset tokens carry one and are only accepted by the matching step.
// `tv` (token version) lets us revoke every token for a user by bumping user.tokenVersion.
function issueToken(user) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion }, secret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
}

function issueResetToken(user, purpose) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion, purpose }, secret(), {
    expiresIn: process.env.JWT_RESET_EXPIRES_IN || "10m",
  });
}

// Returns the active user the token belongs to, or null. `purpose` must match exactly (undefined for sessions).
async function userFromToken(token, purpose) {
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, secret());
  } catch {
    return null;
  }
  if (payload.purpose !== purpose) return null;
  const user = await User.findById(payload.sub).select("+tokenVersion +passwordHash");
  if (!user || !user.active || user.tokenVersion !== payload.tv) return null;
  return user;
}

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function requireAuth(req, res, next) {
  userFromToken(bearer(req))
    .then((user) => {
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      req.user = user;
      next();
    })
    .catch(next);
}

// Sets req.user when a valid session token is present, but never rejects.
function optionalAuth(req, res, next) {
  userFromToken(bearer(req))
    .then((user) => {
      req.user = user || null;
      next();
    })
    .catch(next);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

module.exports = { issueToken, issueResetToken, userFromToken, requireAuth, optionalAuth, requireRole };
