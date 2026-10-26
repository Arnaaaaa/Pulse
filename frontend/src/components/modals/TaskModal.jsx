import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import {
  PRIORITIES,
  TASK_TYPES,
  SEVERITIES,
  PRESET_TAGS,
  todayISO,
  addDays,
  methodologyOf,
} from "../../constants/seedMeta";
import { Modal, TagChip } from "../ui/Primitives";

export function TaskModal() {
  const {
    taskModalState,
    setTaskModalState,
    projects,
    tasks,
    users,
    currentUser,
    canManageProject,
    createTask,
    updateTask,
    showToast,
  } = useApp();

  const { open, defaultProjectId, defaultSprintId, defaultType, editTask } = taskModalState;

  const [projectId, setProjectId] = useState("");
  const [sprintId, setSprintId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Task");
  const [severity, setSeverity] = useState("Medium");
  const [priority, setPriority] = useState("Medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 5));
  const [estimate, setEstimate] = useState(4);
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [dependsOn, setDependsOn] = useState([]);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState("Weekly");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editTask) {
      setProjectId(editTask.projectId || projects[0]?.id || "");
      setSprintId(editTask.sprintId || "");
      setTitle(editTask.title || "");
      setDescription(editTask.description || "");
      setType(editTask.type || "Task");
      setSeverity(editTask.severity || "Medium");
      setPriority(editTask.priority || "Medium");
      setAssigneeId(editTask.assigneeId || "");
      setDueDate(editTask.dueDate || addDays(todayISO(), 5));
      setEstimate(editTask.estimate ?? 4);
      setTags(editTask.tags || []);
      setDependsOn(editTask.dependsOn || []);
      setRecurringEnabled(Boolean(editTask.recurring?.enabled));
      setRecurringFreq(editTask.recurring?.freq || "Weekly");
    } else {
      const pid = defaultProjectId || projects[0]?.id || "";
      setProjectId(pid);
      setSprintId(defaultSprintId || "");
      setTitle("");
      setDescription("");
      setType(defaultType || "Task");
      setSeverity("Medium");
      setPriority("Medium");
      setAssigneeId("");
      setDueDate(addDays(todayISO(), 5));
      setEstimate(4);
      setTags(defaultType === "Bug" ? ["Bug"] : []);
      setDependsOn([]);
      setRecurringEnabled(false);
      setRecurringFreq("Weekly");
    }
  }, [open, editTask, defaultProjectId, defaultSprintId, defaultType, projects]);

  const selectedProject = projects.find((p) => p.id === projectId);
  const projectSprints = selectedProject?.sprints || [];
  const isManager = canManageProject(selectedProject);
  // Assignees must be project members; only managers may assign work to someone else
  const assigneeOptions = users.filter(
    (u) =>
      (selectedProject?.memberIds || []).includes(u.id) &&
      (isManager || u.id === currentUser?.id || u.id === editTask?.assigneeId)
  );
  const projectCandidateTasks = tasks.filter(
    (t) => t.projectId === projectId && (!editTask || t.id !== editTask.id)
  );

  const toggleTag = (tag) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setCustomTag("");
  };

  const toggleDependency = (depId) => {
    setDependsOn((prev) =>
      prev.includes(depId) ? prev.filter((id) => id !== depId) : [...prev, depId]
    );
  };

  const handleClose = () => {
    setTaskModalState({
      open: false,
      defaultProjectId: null,
      defaultSprintId: null,
      defaultType: "Task",
      editTask: null,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!projectId) {
      setError("Please select a project.");
      return;
    }
    if (Number(estimate) < 0) {
      setError("Estimate hours must be 0 or greater.");
      return;
    }

    const payload = {
      projectId,
      sprintId: sprintId || null,
      title: title.trim(),
      description: description.trim(),
      type,
      severity: type === "Bug" || type === "Issue" ? severity : null,
      priority,
      assigneeId: assigneeId || null,
      dueDate,
      estimate: Number(estimate) || 0,
      tags,
      dependsOn,
      recurring: {
        enabled: recurringEnabled,
        freq: recurringFreq,
      },
    };

    setSubmitting(true);
    try {
      // Failures are shown as a toast; keep the form open so nothing typed is lost
      const saved = editTask ? await updateTask(editTask.id, payload) : await createTask(payload);
      if (!saved) return;
      if (editTask) showToast("Task updated", "success");
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editTask ? `Edit ${editTask.type || "Task"}` : "Create New Task / Issue"}
      width="660px"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 6,
              backgroundColor: "var(--danger-soft)",
              color: "var(--danger)",
              marginBottom: 12,
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Title *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Implement OAuth2 callback handler"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Project *</label>
            <select
              className="form-select"
              value={projectId}
              disabled={Boolean(editTask)}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSprintId("");
                setDependsOn([]);
              }}
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{methodologyOf(selectedProject).stage} / Backlog</label>
            <select
              className="form-select"
              value={sprintId}
              onChange={(e) => setSprintId(e.target.value)}
            >
              <option value="">{methodologyOf(selectedProject).backlog}</option>
              {projectSprints.filter((s) => s.status !== "Completed" || s.id === sprintId).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Work Item Type</label>
            <select
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {(type === "Bug" || type === "Issue") && (
            <div className="form-group">
              <label className="form-label">Bug / Issue Severity</label>
              <select
                className="form-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Priority</label>
            <select
              className="form-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Assignee</label>
            <select
              className="form-select"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.title})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Due Date *</label>
            <input
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Estimated Hours</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="form-input"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description & Acceptance Criteria</label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Add implementation details, reproduction steps, or requirements..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Task Dependencies */}
        {projectCandidateTasks.length > 0 && (
          <div className="form-group">
            <label className="form-label">
              Prerequisite Dependencies (Tasks that must be Completed first)
            </label>
            <div
              style={{
                maxHeight: 110,
                overflowY: "auto",
                padding: 8,
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {projectCandidateTasks.map((ct) => (
                <label
                  key={ct.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={dependsOn.includes(ct.id)}
                    onChange={() => toggleDependency(ct.id)}
                  />
                  <span>
                    {ct.title}{" "}
                    <small style={{ color: "var(--text-muted)" }}>({ct.status})</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Recurring Task Configuration */}
        <div
          className="form-group"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={recurringEnabled}
                onChange={(e) => setRecurringEnabled(e.target.checked)}
              />
              <span>Recurring Task (Automatically recreate when completed)</span>
            </label>
            {recurringEnabled && (
              <select
                className="form-select"
                style={{ width: 140 }}
                value={recurringFreq}
                onChange={(e) => setRecurringFreq(e.target.value)}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            )}
          </div>
        </div>

        {/* Labels / Tags */}
        <div className="form-group">
          <label className="form-label">Labels / Tags</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {PRESET_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className={`btn btn-sm ${tags.includes(t) ? "btn-primary" : "btn-secondary"}`}
                onClick={() => toggleTag(t)}
              >
                #{t}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Custom tag..."
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={addCustomTag}>
              Add
            </button>
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {tags.map((t) => (
                <TagChip key={t} tag={t} onRemove={toggleTag} />
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving..." : editTask ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
