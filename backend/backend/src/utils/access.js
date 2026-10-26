const { Project, Activity, Notification } = require("../models");
const { HttpError } = require("./helpers");

// Permission model
// - Admin: manages people only; can view every project but not change it.
// - Project Manager: creates projects; manages projects they are a member of.
// - Team Member: works on projects they are a member of.
const isAdmin = (user) => user.role === "Admin";
const isMember = (user, project) => project.memberIds.some((id) => id.equals(user._id));
const canViewProject = (user, project) => isAdmin(user) || isMember(user, project);
const canManageProject = (user, project) => user.role === "Project Manager" && isMember(user, project);

function visibleProjectFilter(user) {
  return isAdmin(user) ? {} : { memberIds: user._id };
}

async function loadProject(id, user, { manage = false } = {}) {
  const project = await Project.findById(id);
  if (!project || !canViewProject(user, project)) throw new HttpError(404, "Project not found");
  if (manage && !canManageProject(user, project)) throw new HttpError(403, "Forbidden");
  return project;
}

function logActivity(projectId, userId, action, details) {
  return Activity.create({ projectId, userId, action, details });
}

function notify(userId, text, type = "info", extra = {}) {
  if (!userId) return null;
  return Notification.create({ userId, text, type, ...extra });
}

module.exports = {
  isAdmin, isMember, canViewProject, canManageProject,
  visibleProjectFilter, loadProject, logActivity, notify,
};
