const express = require("express");
const { Task, Project, User } = require("../models");
const { STATUSES } = require("../constants");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler, HttpError, pick, escapeRegex } = require("../utils/helpers");
const { todayISO, addInterval } = require("../models/dateOnly");
const multer = require("multer");
const storage = require("../utils/storage");

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 10;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });
const {
  canViewProject, canManageProject, visibleProjectFilter, loadProject, logActivity, notify,
} = require("../utils/access");
const { checkTaskStage, checkTaskProgress } = require("../utils/workflow");

const router = express.Router();
router.use(requireAuth);

const FIELDS = [
  "title", "description", "type", "severity", "priority", "dueDate", "tags", "sprintId",
  "assigneeId", "estimate", "dependsOn", "recurring",
];

// Loads a task the user can see, plus its project and what the user may do with it.
async function loadTask(id, user) {
  const task = await Task.findById(id);
  const project = task && (await Project.findById(task.projectId));
  if (!task || !project || !canViewProject(user, project)) throw new HttpError(404, "Task not found");
  const manager = canManageProject(user, project);
  const involved = task.assigneeId?.equals(user._id) || task.reporterId?.equals(user._id);
  return { task, project, manager, canWork: manager || involved };
}

// Checks assignee, sprint and dependency references against the project.
async function validateRefs(fields, project, user, manager, taskId = null) {
  if (fields.assigneeId) {
    if (!project.memberIds.some((id) => id.equals(fields.assigneeId))) {
      throw new HttpError(400, "Assignee must be a member of the project");
    }
    if (!manager && !user._id.equals(fields.assigneeId)) throw new HttpError(403, "Only a manager can assign tasks to others");
  }
  if (fields.sprintId && !project.sprints.id(fields.sprintId)) throw new HttpError(400, "Unknown sprintId for this project");

  if (fields.dependsOn) {
    const deps = [...new Set(fields.dependsOn.map(String))];
    if (taskId && deps.includes(String(taskId))) throw new HttpError(400, "A task cannot depend on itself");
    const all = await Task.find({ projectId: project._id }, "dependsOn");
    const graph = new Map(all.map((t) => [String(t._id), t.dependsOn.map(String)]));
    if (deps.some((d) => !graph.has(d))) throw new HttpError(400, "dependsOn must reference tasks in the same project");
    if (taskId) {
      // Reject cycles: none of the new dependencies may (transitively) depend on this task
      const seen = new Set();
      const stack = [...deps];
      while (stack.length) {
        const cur = stack.pop();
        if (cur === String(taskId)) throw new HttpError(400, "Dependency cycle detected");
        if (seen.has(cur)) continue;
        seen.add(cur);
        stack.push(...(graph.get(cur) || []));
      }
    }
    fields.dependsOn = deps;
  }
}

// Filters: projectId, assigneeId, status, priority, type, tag, sprintId ("backlog" for none), dueBefore, dueAfter, q
router.get("/", asyncHandler(async (req, res) => {
  const { projectId, assigneeId, status, priority, type, tag, sprintId, dueBefore, dueAfter, q } = req.query;
  const visible = await Project.find(visibleProjectFilter(req.user), "_id");
  const visibleIds = visible.map((p) => String(p._id));

  const filter = { projectId: { $in: visibleIds } };
  if (projectId) filter.projectId = visibleIds.includes(String(projectId)) ? projectId : { $in: [] };
  if (assigneeId) filter.assigneeId = assigneeId === "none" ? null : assigneeId;
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (type) filter.type = type;
  if (tag) filter.tags = tag;
  if (sprintId) filter.sprintId = sprintId === "backlog" ? null : sprintId;
  if (dueBefore || dueAfter) {
    filter.dueDate = {};
    if (dueBefore) filter.dueDate.$lte = dueBefore;
    if (dueAfter) filter.dueDate.$gte = dueAfter;
  }
  if (q) filter.title = { $regex: escapeRegex(q), $options: "i" };
  res.json(await Task.find(filter).sort({ createdAt: -1 }));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json((await loadTask(req.params.id, req.user)).task);
}));

router.post("/", asyncHandler(async (req, res) => {
  if (!req.body.projectId) throw new HttpError(400, "projectId is required");
  const project = await loadProject(String(req.body.projectId), req.user);
  const manager = canManageProject(req.user, project);

  const fields = pick(req.body, FIELDS);
  checkTaskStage(project, fields, { creating: true });
  await validateRefs(fields, project, req.user, manager);
  const task = await Task.create({ ...fields, projectId: project._id, reporterId: req.user._id });

  if (task.assigneeId && !task.assigneeId.equals(req.user._id)) {
    await notify(task.assigneeId, `You were assigned '${task.title}'`, "assign", { projectId: project._id, taskId: task._id });
  }
  await logActivity(project._id, req.user._id, `created ${task.type.toLowerCase()} '${task.title}'`, { taskId: task.id });
  res.status(201).json(task);
}));

// General field edits. Status changes go through /status so the workflow rules always apply.
router.patch("/:id", asyncHandler(async (req, res) => {
  const { task, project, manager, canWork } = await loadTask(req.params.id, req.user);
  if (!canWork) throw new HttpError(403, "Forbidden");

  const fields = pick(req.body, FIELDS);
  if (!manager && "assigneeId" in fields && String(fields.assigneeId) !== String(task.assigneeId)) {
    throw new HttpError(403, "Only a manager can reassign tasks");
  }
  if ("sprintId" in fields && String(fields.sprintId) !== String(task.sprintId)) checkTaskStage(project, fields);
  await validateRefs(fields, project, req.user, manager, task._id);

  const prevAssignee = task.assigneeId;
  task.set(fields);
  const changed = task.modifiedPaths().filter((p) => !p.includes("."));
  await task.save();

  if (task.assigneeId && !task.assigneeId.equals(prevAssignee) && !task.assigneeId.equals(req.user._id)) {
    await notify(task.assigneeId, `You were assigned '${task.title}'`, "assign", { projectId: project._id, taskId: task._id });
  }
  if (changed.length) {
    await logActivity(project._id, req.user._id, `updated '${task.title}'`, { taskId: task.id, fields: changed });
  }
  res.json(task);
}));

// Kanban moves and the review workflow
router.patch("/:id/status", asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) throw new HttpError(400, `status must be one of: ${STATUSES.join(", ")}`);
  const { task, project, manager } = await loadTask(req.params.id, req.user);

  const isAssignee = task.assigneeId?.equals(req.user._id);
  if (!manager && !isAssignee) throw new HttpError(403, "You don't have permission to move this task");
  if (!manager && status === "Completed") {
    throw new HttpError(403, "Only a manager can mark a task Completed. Submit it for review instead.");
  }
  checkTaskProgress(project, task, status);
  if (status !== "To Do" && task.dependsOn.length) {
    const blocking = await Task.find({ _id: { $in: task.dependsOn }, status: { $ne: "Completed" } }, "title");
    if (blocking.length) {
      throw new HttpError(409, `Blocked by unfinished dependencies: ${blocking.map((t) => t.title).join(", ")}`);
    }
  }
  if (status === task.status) return res.json(task);

  const from = task.status;
  task.status = status;
  task.completedAt = status === "Completed" ? new Date() : null;
  await task.save();
  await logActivity(project._id, req.user._id, `moved '${task.title}' to ${status}`, { taskId: task.id, from, to: status });

  const extra = { projectId: project._id, taskId: task._id };
  if (status === "Under Review") {
    const managers = await User.find({ _id: { $in: project.memberIds }, role: "Project Manager", active: true });
    await Promise.all(
      managers.filter((u) => !u._id.equals(req.user._id))
        .map((u) => notify(u._id, `'${task.title}' was submitted for review`, "review", extra))
    );
  }
  if (status === "Completed" && task.assigneeId && !task.assigneeId.equals(req.user._id)) {
    await notify(task.assigneeId, `'${task.title}' was approved and marked Completed`, "approve", extra);
  }

  // Recurring tasks: completing one creates the next occurrence
  let nextOccurrence = null;
  if (status === "Completed" && task.recurring?.enabled) {
    nextOccurrence = await Task.create({
      ...pick(task.toObject(), ["projectId", "sprintId", "title", "description", "type", "severity", "priority",
        "assigneeId", "reporterId", "tags", "estimate", "recurring"]),
      dueDate: addInterval(task.dueDate || todayISO(), task.recurring.freq),
    });
    await logActivity(project._id, req.user._id, `scheduled next ${task.recurring.freq.toLowerCase()} occurrence of '${task.title}'`, { taskId: nextOccurrence.id });
  }
  res.json(nextOccurrence ? { ...task.toJSON(), nextOccurrence } : task);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const { task, project, manager } = await loadTask(req.params.id, req.user);
  const isReporter = task.reporterId?.equals(req.user._id);
  if (!manager && !isReporter) throw new HttpError(403, "Forbidden");
  await task.deleteOne();
  await Task.updateMany({ dependsOn: task._id }, { $pull: { dependsOn: task._id } });
  // Best effort: a storage hiccup should not undo the delete
  await Promise.all(
    task.attachments.filter((a) => a.publicId).map((a) => storage.deleteFile(a.publicId).catch((err) => console.error("[storage]", err.message)))
  );
  await logActivity(project._id, req.user._id, `deleted task '${task.title}'`, { taskId: task.id });
  res.status(204).end();
}));

router.post("/:id/subtasks", asyncHandler(async (req, res) => {
  if (!req.body.text) throw new HttpError(400, "text is required");
  const { task, canWork } = await loadTask(req.params.id, req.user);
  if (!canWork) throw new HttpError(403, "Forbidden");
  task.subtasks.push({ text: req.body.text });
  await task.save();
  res.status(201).json(task.subtasks[task.subtasks.length - 1]);
}));

router.patch("/:id/subtasks/:subId", asyncHandler(async (req, res) => {
  const { task, canWork } = await loadTask(req.params.id, req.user);
  if (!canWork) throw new HttpError(403, "Forbidden");
  const sub = task.subtasks.id(req.params.subId);
  if (!sub) throw new HttpError(404, "Subtask not found");
  if (req.body.text) sub.text = req.body.text;
  sub.done = typeof req.body.done === "boolean" ? req.body.done : !sub.done;
  await task.save();
  res.json(sub);
}));

router.post("/:id/comments", asyncHandler(async (req, res) => {
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  if (!text) throw new HttpError(400, "text is required");
  const { task, project } = await loadTask(req.params.id, req.user);
  task.comments.push({ userId: req.user._id, text });
  await task.save();

  const extra = { projectId: project._id, taskId: task._id };
  const members = await User.find({ _id: { $in: project.memberIds }, active: true }, "name");
  const mentioned = members.filter((u) => text.includes("@" + u.name) && !u._id.equals(req.user._id));
  await Promise.all(mentioned.map((u) => notify(u._id, `${req.user.name} mentioned you on '${task.title}'`, "mention", extra)));
  const assignee = task.assigneeId;
  if (assignee && !assignee.equals(req.user._id) && !mentioned.some((u) => u._id.equals(assignee))) {
    await notify(assignee, `${req.user.name} commented on '${task.title}'`, "comment", extra);
  }
  await logActivity(project._id, req.user._id, `commented on '${task.title}'`, { taskId: task.id });
  res.status(201).json(task.comments[task.comments.length - 1]);
}));

// Attach either an uploaded file (multipart field "file", stored in Cloudinary) or a link (JSON { url, name? }).
router.post("/:id/attachments", upload.single("file"), asyncHandler(async (req, res) => {
  const { task, project } = await loadTask(req.params.id, req.user);
  let attachment;
  if (req.file) {
    const { publicId } = await storage.uploadFile(req.file, task.id);
    attachment = {
      name: req.file.originalname,
      publicId,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user._id,
    };
  } else {
    const url = String(req.body.url || "").trim();
    if (!/^https?:\/\/\S+$/i.test(url)) throw new HttpError(400, "Upload a file or provide an http(s) link");
    attachment = { name: String(req.body.name || "").trim() || url, url, uploadedBy: req.user._id };
  }
  task.attachments.push(attachment);
  await task.save();
  await logActivity(project._id, req.user._id, `attached '${attachment.name}' to '${task.title}'`, { taskId: task.id });
  res.status(201).json(task.attachments[task.attachments.length - 1]);
}));

// Returns a link to open the attachment: the saved URL for links, a short-lived signed URL for files
router.get("/:id/attachments/:attId/download", asyncHandler(async (req, res) => {
  const { task } = await loadTask(req.params.id, req.user);
  const att = task.attachments.id(req.params.attId);
  if (!att) throw new HttpError(404, "Attachment not found");
  res.json({ url: att.publicId ? storage.downloadUrl(att.publicId) : att.url });
}));

// The uploader or a project manager can remove an attachment
router.delete("/:id/attachments/:attId", asyncHandler(async (req, res) => {
  const { task, project, manager } = await loadTask(req.params.id, req.user);
  const att = task.attachments.id(req.params.attId);
  if (!att) throw new HttpError(404, "Attachment not found");
  if (!manager && !att.uploadedBy?.equals(req.user._id)) throw new HttpError(403, "Only the uploader or a manager can remove this");
  if (att.publicId) await storage.deleteFile(att.publicId);
  att.deleteOne();
  await task.save();
  await logActivity(project._id, req.user._id, `removed attachment '${att.name}' from '${task.title}'`, { taskId: task.id });
  res.status(204).end();
}));

router.post("/:id/time-log", asyncHandler(async (req, res) => {
  const hours = Number(req.body.hours);
  if (!(hours > 0 && hours <= 24)) throw new HttpError(400, "hours must be a number between 0 and 24");
  const { task, project, manager } = await loadTask(req.params.id, req.user);
  if (!manager && !task.assigneeId?.equals(req.user._id)) throw new HttpError(403, "Only the assignee or a manager can log time");
  task.timeLogs.push({ userId: req.user._id, hours, note: req.body.note || "" });
  task.timeLogged += hours;
  await task.save();
  await logActivity(project._id, req.user._id, `logged ${hours}h on '${task.title}'`, { taskId: task.id, hours });
  res.json(task);
}));

module.exports = router;
