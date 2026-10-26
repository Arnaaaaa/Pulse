const express = require("express");
const { User, Project } = require("../models");
const { ROLES } = require("../constants");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler, HttpError, normalizeEmail } = require("../utils/helpers");
const { isAdmin, canManageProject, isMember } = require("../utils/access");

const router = express.Router();

// Who can see whom:
// - Admin: everyone, including deactivated accounts.
// - Project Manager: every active employee (to staff projects), with ratings.
// - Team Member: people they share a project with, without ratings.
async function colleagueIds(user) {
  const projects = await Project.find({ memberIds: user._id }, "memberIds");
  return [user._id, ...projects.flatMap((p) => p.memberIds)];
}

async function visibleUsersFilter(user) {
  if (isAdmin(user)) return { filter: {}, projection: undefined };
  if (user.role === "Project Manager") return { filter: { active: true }, projection: undefined };
  return { filter: { _id: { $in: await colleagueIds(user) }, active: true }, projection: "-ratings" };
}

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { filter, projection } = await visibleUsersFilter(req.user);
  res.json(await User.find(filter, projection).sort({ name: 1 }));
}));

router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const { filter, projection } = await visibleUsersFilter(req.user);
  const user = req.user._id.equals(req.params.id)
    ? await User.findById(req.params.id)
    : await User.findOne({ $and: [filter, { _id: req.params.id }] }, projection);
  if (!user) throw new HttpError(404, "Not found");
  res.json(user);
}));

// Admin enters a new employee's name, email and role. They then use the New User login flow.
const createEmployee = [
  requireRole("Admin"),
  asyncHandler(async (req, res) => {
    const { name, email, role, title } = req.body;
    if (!name || !email) throw new HttpError(400, "name and email are required");
    if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ROLES.join(", ")}`);
    if (await User.exists({ email: normalizeEmail(email) })) throw new HttpError(409, "Email already exists");
    const user = await User.create({ name, email, role, title: title || role });
    res.status(201).json({ user, message: "Employee created. They can now use New User login." });
  }),
];
router.post("/", requireAuth, createEmployee);

// Admin panel: edit name/title/role, or deactivate an employee
router.patch("/:id", requireAuth, requireRole("Admin"), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("+tokenVersion");
  if (!user) throw new HttpError(404, "Not found");
  const { name, title, color, role, active } = req.body;
  const isSelf = user._id.equals(req.user._id);

  if (role !== undefined && role !== user.role) {
    if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ROLES.join(", ")}`);
    if (isSelf) throw new HttpError(400, "You cannot change your own role");
    user.role = role;
    user.tokenVersion += 1;
  }
  if (active !== undefined && Boolean(active) !== user.active) {
    if (isSelf) throw new HttpError(400, "You cannot deactivate yourself");
    user.active = Boolean(active);
    user.tokenVersion += 1;
  }
  if (name) user.name = name;
  if (title !== undefined) user.title = title;
  if (color) user.color = color;
  await user.save();
  res.json(user);
}));

// A project's manager rates a member of that project
router.post("/:id/ratings", requireAuth, asyncHandler(async (req, res) => {
  const { projectId, feedback } = req.body;
  const rating = Number(req.body.rating);
  if (!projectId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, "projectId and an integer rating from 1 to 5 are required");
  }
  const [user, project] = await Promise.all([User.findById(req.params.id), Project.findById(String(projectId))]);
  if (!user || !project) throw new HttpError(404, "Not found");
  if (!canManageProject(req.user, project)) throw new HttpError(403, "Forbidden");
  if (!isMember(user, project)) throw new HttpError(400, "User is not a member of this project");
  if (user._id.equals(req.user._id)) throw new HttpError(400, "You cannot rate yourself");

  user.ratings.push({ projectId, raterId: req.user._id, rating, feedback: feedback || "" });
  await user.save();
  res.status(201).json(user);
}));

module.exports = router;
module.exports.createEmployee = createEmployee;
