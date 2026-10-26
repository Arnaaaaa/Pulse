const { Task } = require("../models");
const { HttpError } = require("./helpers");

// Work-process rules per project methodology. A project's `sprints` array holds its stages in order:
// - Agile: sprints. Any order; unfinished work returns to the backlog when a sprint completes.
// - Waterfall: phases. Strictly sequential: a phase starts only after every earlier phase is Completed,
//   it completes only when all its tasks are Completed, and its tasks cannot progress until it is Active.
// - Iterative: iterations. One at a time, in order; tasks progress only in the Active iteration and
//   unfinished work carries over to the next iteration when one completes.
const STAGE_LABEL = { Agile: "sprint", Waterfall: "phase", Iterative: "iteration" };

const WATERFALL_PHASES = [
  ["Requirements", "Gather and sign off requirements"],
  ["Design", "System and detailed design"],
  ["Implementation", "Build the solution"],
  ["Verification", "Test and accept the solution"],
  ["Deployment & Maintenance", "Release and support"],
];

const stageLabel = (project) => STAGE_LABEL[project.methodology] || "sprint";
const isSequential = (project) => project.methodology === "Waterfall" || project.methodology === "Iterative";

// Splits [start, end] into `count` consecutive ranges.
function splitDates(start, end, count) {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = end ? new Date(`${end}T00:00:00Z`).getTime() : s + count * 14 * 86400000;
  const step = Math.max(Math.floor((e - s) / count), 86400000);
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  return Array.from({ length: count }, (_, i) => [iso(s + i * step), iso(i === count - 1 ? Math.max(e, s + i * step) : s + (i + 1) * step - 86400000)]);
}

// Default stages for a new project that was created without any.
function defaultStages(methodology, startDate, endDate) {
  if (methodology === "Waterfall") {
    return splitDates(startDate, endDate, WATERFALL_PHASES.length).map(([start, end], i) => ({
      name: WATERFALL_PHASES[i][0], goal: WATERFALL_PHASES[i][1], start, end, status: i === 0 ? "Active" : "Planned",
    }));
  }
  if (methodology === "Iterative") {
    return splitDates(startDate, endDate, 3).map(([start, end], i) => ({
      name: `Iteration ${i + 1}`, goal: "", start, end, status: i === 0 ? "Active" : "Planned",
    }));
  }
  return [];
}

// Sequential methodologies have exactly one Active stage: the first that is not Completed.
function normalizeStages(project) {
  if (!isSequential(project)) return;
  let activeSet = false;
  for (const s of project.sprints) {
    if (s.status === "Completed") continue;
    s.status = activeSet ? "Planned" : "Active";
    activeSet = true;
  }
}

// Validates a stage status change; returns a function to run after saving (moving unfinished tasks).
async function checkStageTransition(project, stage, newStatus) {
  if (!newStatus || newStatus === stage.status) return async () => {};
  const label = stageLabel(project);
  const index = project.sprints.findIndex((s) => s._id.equals(stage._id));
  const earlier = project.sprints.slice(0, index);
  const later = project.sprints.slice(index + 1);
  const open = await Task.find({ projectId: project._id, sprintId: stage._id, status: { $ne: "Completed" } }, "_id");

  if (isSequential(project)) {
    if (newStatus === "Active" && earlier.some((s) => s.status !== "Completed")) {
      throw new HttpError(409, `Complete the earlier ${label}s before starting this one (${project.methodology})`);
    }
    if (stage.status === "Completed" && later.some((s) => s.status !== "Planned")) {
      throw new HttpError(409, `A later ${label} has already started; this ${label} cannot be reopened`);
    }
    if (newStatus === "Planned" && stage.status === "Active") {
      throw new HttpError(409, `The current ${label} cannot be moved back to Planned`);
    }
  }
  if (project.methodology === "Waterfall" && newStatus === "Completed" && open.length) {
    throw new HttpError(409, `All tasks in this phase must be Completed before the phase can be signed off (${open.length} open)`);
  }

  return async () => {
    if (newStatus !== "Completed" || !open.length) return;
    // Agile: back to the backlog. Iterative: carry over to the next iteration (or the backlog if none).
    const next = project.methodology === "Iterative" ? later.find((s) => s.status !== "Completed") : null;
    await Task.updateMany({ _id: { $in: open.map((t) => t._id) } }, { sprintId: next ? next._id : null });
  };
}

// Picks / validates the stage a task goes into.
function checkTaskStage(project, fields, { creating = false } = {}) {
  const label = stageLabel(project);
  if (creating && project.methodology === "Waterfall" && !fields.sprintId) {
    // Waterfall work always belongs to a phase: default to the current one
    const current = project.sprints.find((s) => s.status !== "Completed");
    if (current) fields.sprintId = current._id;
  }
  if (fields.sprintId && isSequential(project) && project.sprints.id(fields.sprintId)?.status === "Completed") {
    throw new HttpError(409, `This ${label} is already Completed; add work to a current or later ${label}`);
  }
}

// Whether a task may leave "To Do" given its stage.
function checkTaskProgress(project, task, newStatus) {
  if (!isSequential(project) || newStatus === "To Do") return;
  const label = stageLabel(project);
  if (!task.sprintId) {
    if (project.methodology === "Waterfall") throw new HttpError(409, "Assign this task to a phase before working on it");
    throw new HttpError(409, "Plan this task into the active iteration before working on it");
  }
  const stage = project.sprints.id(task.sprintId);
  if (stage && stage.status === "Planned") {
    throw new HttpError(409, `'${stage.name}' has not started yet; work on this ${label} begins when it becomes Active`);
  }
}

module.exports = {
  stageLabel, defaultStages, normalizeStages, checkStageTransition, checkTaskStage, checkTaskProgress,
};
