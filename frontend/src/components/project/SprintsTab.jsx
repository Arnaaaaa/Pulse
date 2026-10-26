import React, { useState } from "react";
import { Plus, Zap, Inbox } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { todayISO, addDays, methodologyOf } from "../../constants/seedMeta";
import {
  StatusBadge,
  PriorityBadge,
  UserAvatar,
  EmptyState,
} from "../ui/Primitives";

export function SprintsTab({ project }) {
  const {
    tasks,
    users,
    currentUser,
    canManageProject,
    createSprint,
    updateSprint,
    updateTask,
    canEditTask,
    setActiveTaskId,
    setTaskModalState,
  } = useApp();

  const manageable = canManageProject(project);
  const model = methodologyOf(project);
  const methodology = project.methodology || "Agile";
  // Waterfall and Iterative run their stages in order, so the server decides which one is Active
  const sequential = methodology !== "Agile";
  const stages = project.sprints || [];
  const HINTS = {
    Agile: "Plan sprints freely, pull items from the backlog, and run several sprints if needed. Completing a sprint returns unfinished work to the backlog.",
    Waterfall: "Phases run strictly in order. Work in a phase can only start once that phase is Active, and a phase can be signed off only when all its tasks are Completed.",
    Iterative: "Iterations run one at a time, in order. Work progresses only in the Active iteration; completing it carries unfinished work over to the next iteration.",
  };
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const backlogTasks = projectTasks.filter((t) => !t.sprintId);

  const [showSprintForm, setShowSprintForm] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(addDays(todayISO(), 14));
  const [status, setStatus] = useState("Planned");

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await createSprint(project.id, {
      name: name.trim(),
      goal: goal.trim(),
      start,
      end,
      status,
    });
    if (!created) return;
    setName("");
    setGoal("");
    setShowSprintForm(false);
  };

  const handleSprintStatusChange = async (sprintId, newStatus) => {
    await updateSprint(project.id, sprintId, { status: newStatus });
  };

  const handleAssignSprint = async (taskId, sprintId) => {
    await updateTask(taskId, { sprintId: sprintId || null });
  };

  return (
    <div>
      {/* Header & New Sprint Action */}
      <div
        className="card"
        style={{
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            {methodology} Plan — {model.stages} & Backlog ({stages.length} {model.stages})
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
            {HINTS[methodology]}
          </p>
        </div>

        {manageable && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowSprintForm((v) => !v)}
          >
            <Plus size={15} /> {showSprintForm ? "Cancel" : `Add ${model.stage}`}
          </button>
        )}
      </div>

      {/* Create Sprint Form */}
      {showSprintForm && manageable && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 12px" }}>New {model.stage}</h4>
          {sequential && (
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
              New {model.stages.toLowerCase()} are added at the end of the plan and start once the ones before them are Completed.
            </p>
          )}
          <form onSubmit={handleCreateSprint}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{model.stage} Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={`e.g. ${model.stage} ${stages.length + 1}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              {!sequential && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="Planned">Planned</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{model.stage} Goal</label>
              <input
                type="text"
                className="form-input"
                placeholder={`What is the primary deliverable of this ${model.stage.toLowerCase()}?`}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-sm">
              Save {model.stage}
            </button>
          </form>
        </div>
      )}

      {/* Sprints List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
        {stages.map((sprint, index) => {
          const sTasks = projectTasks.filter((t) => t.sprintId === sprint.id);
          const done = sTasks.filter((t) => t.status === "Completed").length;
          const pct = sTasks.length > 0 ? Math.round((done / sTasks.length) * 100) : 0;

          return (
            <div key={sprint.id} className="card">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Zap size={16} color="var(--brand)" />
                    <h4 style={{ margin: 0, fontSize: 15.5 }}>
                      {sequential && `${index + 1}. `}
                      {sprint.name}
                    </h4>
                    <StatusBadge status={sprint.status} />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>
                    Goal: <strong>{sprint.goal || `Deliver ${model.stage.toLowerCase()} work items`}</strong> •{" "}
                    {sprint.start} → {sprint.end}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {manageable && sequential && sprint.status === "Active" && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSprintStatusChange(sprint.id, "Completed")}
                    >
                      {methodology === "Waterfall" ? "Sign Off Phase" : "Complete Iteration"}
                    </button>
                  )}
                  {manageable && !sequential && (
                    <select
                      className="form-select"
                      style={{ width: 130, padding: "4px 8px", fontSize: 12 }}
                      value={sprint.status}
                      onChange={(e) => handleSprintStatusChange(sprint.id, e.target.value)}
                    >
                      <option value="Planned">Planned</option>
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setTaskModalState({
                        open: true,
                        defaultProjectId: project.id,
                        defaultSprintId: sprint.id,
                        defaultType: "Task",
                        editTask: null,
                      })
                    }
                  >
                    <Plus size={14} /> Add {model.stage} Task
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span>
                  {model.stage} Completion ({done}/{sTasks.length} tasks)
                </span>
                <strong>{pct}%</strong>
              </div>
              <div className="progress-track" style={{ marginBottom: 14 }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>

              {sTasks.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  No tasks in this {model.stage.toLowerCase()} yet. Move items from the {model.backlog} below.
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Assignee</th>
                        <th>Due Date</th>
                        <th>{model.stage}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sTasks.map((t) => {
                        const assignee = users.find((u) => u.id === t.assigneeId);
                        return (
                          <tr key={t.id}>
                            <td
                              style={{ fontWeight: 600, cursor: "pointer" }}
                              onClick={() => setActiveTaskId(t.id)}
                            >
                              {t.title}
                            </td>
                            <td>
                              <StatusBadge status={t.status} />
                            </td>
                            <td>
                              <PriorityBadge priority={t.priority} />
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <UserAvatar user={assignee} size={22} />
                                <span>{assignee?.name || "Unassigned"}</span>
                              </div>
                            </td>
                            <td>{t.dueDate || "—"}</td>
                            <td>
                              <select
                                className="form-select"
                                style={{ padding: "4px 8px", fontSize: 12 }}
                                value={t.sprintId || ""}
                                disabled={!canEditTask(t)}
                                onChange={(e) => handleAssignSprint(t.id, e.target.value)}
                              >
                                <option value="">Move to Backlog</option>
                                {stages.filter((sp) => sp.status !== "Completed" || sp.id === t.sprintId).map((sp) => (
                                  <option key={sp.id} value={sp.id}>
                                    {sp.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Product Backlog Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Inbox size={17} /> {model.backlog} ({backlogTasks.length} Unassigned Tasks)
          </h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              setTaskModalState({
                open: true,
                defaultProjectId: project.id,
                defaultSprintId: null,
                defaultType: "Task",
                editTask: null,
              })
            }
          >
            <Plus size={14} /> Add Backlog Item
          </button>
        </div>

        {backlogTasks.length === 0 ? (
          <EmptyState
            title={`${model.backlog} is empty`}
            description={`All project tasks are currently scheduled into ${model.stages.toLowerCase()}.`}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Backlog Item</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Assign to {model.stage}</th>
                </tr>
              </thead>
              <tbody>
                {backlogTasks.map((t) => {
                  const assignee = users.find((u) => u.id === t.assigneeId);
                  return (
                    <tr key={t.id}>
                      <td
                        style={{ fontWeight: 600, cursor: "pointer" }}
                        onClick={() => setActiveTaskId(t.id)}
                      >
                        {t.title}
                      </td>
                      <td>
                        <StatusBadge status={t.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <UserAvatar user={assignee} size={22} />
                          <span>{assignee?.name || "Unassigned"}</span>
                        </div>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          style={{ padding: "4px 8px", fontSize: 12 }}
                          value={t.sprintId || ""}
                          disabled={!canEditTask(t)}
                          onChange={(e) => handleAssignSprint(t.id, e.target.value)}
                        >
                          <option value="">{model.backlog}</option>
                          {stages.filter((sp) => sp.status !== "Completed").map((sp) => (
                            <option key={sp.id} value={sp.id}>
                              {sp.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
