const express = require("express");
const { Project, Task, User } = require("../models");
const { PROJECT_STATUSES, METHODOLOGIES } = require("../constants");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler, HttpError, pick, subdocs } = require("../utils/helpers");
const { visibleProjectFilter, loadProject, logActivity, isMember } = require("../utils/access");
const { stageLabel, defaultStages, normalizeStages, checkStageTransition } = require("../utils/workflow");

const router = express.Router();
router.use(requireAuth);

const EDITABLE = ["name", "client", "description", "template", "startDate", "endDate", "tags"];
const MILESTONE_FIELDS = ["name", "date", "done"];
const SPRINT_FIELDS = ["name", "goal", "start", "end", "status"];
const MEETING_FIELDS = ["title", "date", "time", "notes", "attendeeIds"];
const ACTION_ITEM_FIELDS = ["text", "ownerId", "done"];

// Editable fields from the request body, with arrays of subdocuments cleaned up
function projectFields(body) {
  const fields = pick(body, EDITABLE);
  if (body.milestones !== undefined) fields.milestones = subdocs(body.milestones, MILESTONE_FIELDS);
  return fields;
}

function meetingFields(project, body) {
  const fields = pick(body, MEETING_FIELDS);
  if (body.actionItems !== undefined) fields.actionItems = subdocs(body.actionItems, ACTION_ITEM_FIELDS);
  (fields.attendeeIds || []).forEach((id) => assertMember(project, id, "attendeeIds"));
  (fields.actionItems || []).forEach((ai) => assertMember(project, ai.ownerId, "actionItems.ownerId"));
  return fields;
}

async function assertActiveUsers(ids) {
  const unique = [...new Set(ids.map(String))];
  if ((await User.countDocuments({ _id: { $in: unique }, active: true, role: "Team Member" })) !== unique.length) {
    throw new HttpError(400, "memberIds must be active Team Members");
  }
  return unique;
}

function assertMember(project, userId, field) {
  if (userId && !project.memberIds.some((id) => id.equals(userId))) {
    throw new HttpError(400, `${field} must be a member of the project`);
  }
}

router.get("/", asyncHandler(async (req, res) => {
  res.json(await Project.find(visibleProjectFilter(req.user)).sort({ updatedAt: -1 }));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await loadProject(req.params.id, req.user));
}));

router.post("/", asyncHandler(async (req, res) => {
  if (req.user.role !== "Project Manager") throw new HttpError(403, "Only Project Managers can create projects");
  const methodology = req.body.methodology || "Agile";
  if (!METHODOLOGIES.includes(methodology)) throw new HttpError(400, `methodology must be one of: ${METHODOLOGIES.join(", ")}`);
  // The creating PM is added automatically; clients may still send their own id, which is not a Team Member
  const requested = (Array.isArray(req.body.memberIds) ? req.body.memberIds : []).filter((id) => String(id) !== req.user.id);
  const memberIds = await assertActiveUsers(requested);
  memberIds.push(req.user.id); // the PM who creates a project manages it

  const fields = projectFields(req.body);
  const project = new Project({
    name: "Untitled Project",
    ...fields,
    ...pick(req.body, ["status"]),
    methodology,
    memberIds,
    createdBy: req.user._id,
  });
  // Stages come from a project template, or default to the methodology's standard ones
  const stages = subdocs(req.body.sprints, SPRINT_FIELDS);
  project.sprints = stages?.length ? stages : defaultStages(methodology, project.startDate, project.endDate);
  normalizeStages(project);
  await project.save();
  await logActivity(project._id, req.user._id, `created project (${methodology})`);
  res.status(201).json(project);
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.id, req.user, { manage: true });
  const changes = projectFields(req.body);
  project.set(changes);
  await project.save();
  await logActivity(project._id, req.user._id, "updated project details", { fields: Object.keys(changes) });
  res.json(project);
}));

// body: { status: "Active" | "Archived" | "Completed" }
router.patch("/:id/status", asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!PROJECT_STATUSES.includes(status)) throw new HttpError(400, `status must be one of: ${PROJECT_STATUSES.join(", ")}`);
  const project = await loadProject(req.params.id, req.user, { manage: true });
  const from = project.status;
  project.status = status;
  await project.save();
  await logActivity(project._id, req.user._id, `marked the project ${status}`, { from, to: status });
  res.json(project);
}));

router.post("/:id/announcements", asyncHandler(async (req, res) => {
  if (!req.body.text) throw new HttpError(400, "text is required");
  const project = await loadProject(req.params.id, req.user, { manage: true });
  project.announcements.unshift({ authorId: req.user._id, text: req.body.text });
  await project.save();
  await logActivity(project._id, req.user._id, "posted an announcement");
  res.status(201).json(project.announcements[0]);
}));

router.post("/:id/members", asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.id, req.user, { manage: true });
  const { userId } = req.body;
  if (!userId) throw new HttpError(400, "userId is required");
  const user = await User.findOne({ _id: String(userId), active: true });
  if (!user) throw new HttpError(400, "Unknown or inactive user");
  if (user.role !== "Team Member") throw new HttpError(400, "Only Team Members can be added to a project");
  if (!isMember(user, project)) {
    project.memberIds.push(user._id);
    await project.save();
    await logActivity(project._id, req.user._id, `added ${user.name} to the team`, { userId: user.id });
  }
  res.json(project);
}));

router.delete("/:id/members/:userId", asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.id, req.user, { manage: true });
  const before = project.memberIds.length;
  const remaining = project.memberIds.filter((id) => !id.equals(req.params.userId));
  if (remaining.length !== before) {
    project.memberIds = remaining;
    await project.save();
    // Their open work in this project goes back to unassigned
    await Task.updateMany(
      { projectId: project._id, assigneeId: req.params.userId, status: { $ne: "Completed" } },
      { assigneeId: null }
    );
    await logActivity(project._id, req.user._id, "removed a member from the team", { userId: req.params.userId });
  }
  res.json(project);
}));

router.post("/:id/sprints", asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.id, req.user, { manage: true });
  // New stages always join the end of the plan; sequential methodologies decide their status
  project.sprints.push(pick(req.body, SPRINT_FIELDS));
  const sprint = project.sprints[project.sprints.length - 1];
  normalizeStages(project);
  await project.save();
  await logActivity(project._id, req.user._id, `created ${stageLabel(project)} '${sprint.name}'`);
  res.status(201).json(sprint);
}));

router.patch("/:id/sprints/:sprintId", asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.id, req.user, { manage: true });
  const sprint = project.sprints.id(req.params.sprintId);
  if (!sprint) throw new HttpError(404, "Sprint not found");
  const changes = pick(req.body, SPRINT_FIELDS);
  const afterSave = await checkStageTransition(project, sprint, changes.status);
  sprint.set(changes);
  normalizeStages(project);
  await project.save();
  await afterSave();
  await logActivity(project._id, req.user._id, `updated ${stageLabel(project)} '${sprint.name}'`, { fields: Object.keys(changes) });
  res.json(sprint);
}));

router.post("/:id/risks", asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.id, req.user, { manage: true });
  const fields = pick(req.body, ["title", "description", "probability", "impact", "mitigation", "ownerId", "status"]);
  assertMember(project, fields.ownerId, "ownerId");
  project.risks.push(fields);
  const risk = project.risks[project.risks.length - 1];
  await project.save();
  await logActivity(project._id, req.user._id, `logged risk '${risk.title}'`);
  res.status(201).json(risk);
}));

router.delete("/:id/risks/:riskId", asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.id, req.user, { manage: true });
  const risk = project.risks.id(req.params.riskId);
  if (!risk) throw new HttpError(404, "Risk not found");
  risk.deleteOne();
  await project.save();
  await logActivity(project._id, req.user._id, `removed risk '${risk.title}'`);
  res.status(204).end();
}));

router.post("/:id/meetings", asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.id, req.user, { manage: true });
  project.meetings.unshift(meetingFields(project, req.body));
  await project.save();
  await logActivity(project._id, req.user._id, `scheduled meeting '${project.meetings[0].title}'`);
  res.status(201).json(project.meetings[0]);
}));

// Edit notes, reschedule, or tick off action items
router.patch("/:id/meetings/:meetingId", asyncHandler(async (req, res) => {
  const project = await loadProject(req.params.id, req.user, { manage: true });
  const meeting = project.meetings.id(req.params.meetingId);
  if (!meeting) throw new HttpError(404, "Meeting not found");
  const changes = meetingFields(project, req.body);
  meeting.set(changes);
  await project.save();
  await logActivity(project._id, req.user._id, `updated meeting '${meeting.title}'`, { fields: Object.keys(changes) });
  res.json(meeting);
}));

module.exports = router;
