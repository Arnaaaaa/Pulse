import React, { useState } from "react";
import {
  CheckSquare,
  Clock,
  Paperclip,
  MessageSquare,
  Send,
  Trash2,
  Edit3,
  Link2,
  Repeat,
  CheckCircle2,
  AlertTriangle,
  AtSign,
  X,
} from "lucide-react";

const MAX_UPLOAD_MB = 10;

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
import { useApp } from "../../context/AppContext";
import { STATUSES, isTaskOverdue, formatDateTime, methodologyOf } from "../../constants/seedMeta";
import {
  Drawer,
  StatusBadge,
  PriorityBadge,
  SeverityBadge,
  TagChip,
  UserAvatar,
} from "../ui/Primitives";

export function TaskDetailDrawer() {
  const {
    activeTaskId,
    setActiveTaskId,
    tasks,
    projects,
    users,
    currentUser,
    canManageProject,
    canMoveTask,
    canEditTask,
    canDeleteTask,
    changeTaskStatus,
    deleteTask,
    addSubtask,
    toggleSubtask,
    addComment,
    addAttachment,
    openAttachment,
    deleteAttachment,
    logTaskTime,
    setTaskModalState,
    showToast,
  } = useApp();

  const task = tasks.find((t) => t.id === activeTaskId);
  const project = task ? projects.find((p) => p.id === task.projectId) : null;

  const [subtaskText, setSubtaskText] = useState("");
  const [hoursInput, setHoursInput] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [commentText, setCommentText] = useState("");

  if (!task) return null;

  const isManager = canManageProject(project);
  const isOwner = currentUser?.id === task.assigneeId;
  const allowedToMove = canMoveTask(task); // also: may log time
  const allowedToEdit = canEditTask(task); // fields and checklist
  const allowedToDelete = canDeleteTask(task);
  const projectMembers = users.filter((u) => (project?.memberIds || []).includes(u.id) && u.id !== currentUser?.id);
  const assignee = users.find((u) => u.id === task.assigneeId);
  const reporter = users.find((u) => u.id === task.reporterId);
  const sprint = project?.sprints?.find((s) => s.id === task.sprintId);

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => s.done).length;
  const subtaskPct = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  const dependencyTasks = (task.dependsOn || [])
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean);
  const unfinishedDeps = dependencyTasks.filter((d) => d.status !== "Completed");

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!subtaskText.trim()) return;
    if (await addSubtask(task.id, subtaskText.trim())) setSubtaskText("");
  };

  const handleLogTime = async (e) => {
    e.preventDefault();
    const h = Number(hoursInput);
    if (!h || h <= 0) return;
    if (await logTaskTime(task.id, h)) setHoursInput("");
  };

  const handleAddLink = async (e) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    if (await addAttachment(task.id, { url: linkUrl.trim() })) setLinkUrl("");
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      showToast(`"${file.name}" is larger than ${MAX_UPLOAD_MB} MB`, "error");
      return;
    }
    setUploading(true);
    await addAttachment(task.id, { file });
    setUploading(false);
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (await addComment(task.id, commentText.trim())) setCommentText("");
  };

  const insertMention = (userName) => {
    setCommentText((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@${userName} `);
  };

  return (
    <Drawer
      open={Boolean(task)}
      onClose={() => setActiveTaskId(null)}
      title={`${task.type || "Task"} • ${project?.name || ""}`}
      width="680px"
    >
      {/* Top Meta & Action Controls */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.severity && <SeverityBadge severity={task.severity} />}
            {task.recurring?.enabled && (
              <span className="badge badge-status-progress">
                <Repeat size={11} /> {task.recurring.freq}
              </span>
            )}
            {isTaskOverdue(task) && (
              <span className="badge badge-priority-critical">Overdue</span>
            )}
          </div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{task.title}</h2>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {allowedToEdit && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              setTaskModalState({
                open: true,
                defaultProjectId: task.projectId,
                defaultSprintId: task.sprintId,
                defaultType: task.type,
                editTask: task,
              })
            }
          >
            <Edit3 size={14} /> Edit
          </button>
          )}
          {allowedToDelete && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm(`Delete task "${task.title}"?`)) {
                deleteTask(task.id);
              }
            }}
          >
            <Trash2 size={14} />
          </button>
          )}
        </div>
      </div>

      {/* Review & Approval Workflow Banner (Requirement #31) */}
      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 16,
          backgroundColor: "var(--bg-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Workflow & Review Stage
            </div>
            <div style={{ fontSize: 13, marginTop: 2 }}>
              {task.status === "Under Review"
                ? "Submitted for review — awaiting Project Manager or Admin approval."
                : !isManager && isOwner
                ? "As a Team Member, submit completed work for review so a manager can approve it."
                : "Move task across workflow stages."}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {allowedToMove &&
              STATUSES.map((st) => {
                const blockedForMember = !isManager && st === "Completed";
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={task.status === st || blockedForMember}
                    title={
                      blockedForMember
                        ? "Only a Project Manager or Admin can mark a task Completed — submit for review instead"
                        : undefined
                    }
                    className={`btn btn-sm ${
                      task.status === st ? "btn-primary" : "btn-secondary"
                    }`}
                    onClick={() => changeTaskStatus(task, st)}
                  >
                    {st === "Under Review" && !isManager ? "Submit for Review" : st}
                  </button>
                );
              })}

            {isManager && task.status === "Under Review" && (
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => changeTaskStatus(task, "Completed")}
              >
                <CheckCircle2 size={14} /> Approve & Complete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Task Metadata Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 18,
          padding: 14,
          borderRadius: 8,
          border: "1px solid var(--border-color)",
        }}
      >
        <div>
          <div className="form-label">Assignee</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <UserAvatar user={assignee} size={26} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              {assignee ? assignee.name : "Unassigned"}
            </span>
          </div>
        </div>

        <div>
          <div className="form-label">Reporter</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <UserAvatar user={reporter} size={26} />
            <span style={{ fontSize: 13 }}>{reporter ? reporter.name : "System"}</span>
          </div>
        </div>

        <div>
          <div className="form-label">Due Date</div>
          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>
            {task.dueDate || "No due date"}
          </div>
        </div>

        <div>
          <div className="form-label">{methodologyOf(project).stage}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {sprint ? sprint.name : methodologyOf(project).backlog}
          </div>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <div style={{ marginBottom: 18 }}>
          <div className="form-label" style={{ marginBottom: 4 }}>
            Description
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: "var(--bg-subtle)",
              fontSize: 13.5,
              whiteSpace: "pre-wrap",
            }}
          >
            {task.description}
          </div>
        </div>
      )}

      {/* Tags */}
      {(task.tags || []).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          {task.tags.map((t) => (
            <TagChip key={t} tag={t} />
          ))}
        </div>
      )}

      {/* Prerequisite Dependencies */}
      {dependencyTasks.length > 0 && (
        <div className="card" style={{ marginBottom: 18, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
              <Link2 size={15} /> Prerequisite Dependencies ({dependencyTasks.length})
            </div>
            {unfinishedDeps.length > 0 && (
              <span className="badge badge-priority-critical">
                <AlertTriangle size={12} /> Blocked ({unfinishedDeps.length} pending)
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dependencyTasks.map((dep) => (
              <div
                key={dep.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: 6,
                  backgroundColor: "var(--bg-subtle)",
                  cursor: "pointer",
                }}
                onClick={() => setActiveTaskId(dep.id)}
              >
                <span style={{ fontWeight: 500, fontSize: 13 }}>{dep.title}</span>
                <StatusBadge status={dep.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtasks & Checklist (Requirement #6) */}
      <div className="card" style={{ marginBottom: 18, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
            <CheckSquare size={15} /> Subtasks & Checklist ({completedSubtasks}/{subtasks.length})
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            {subtaskPct}%
          </span>
        </div>

        <div className="progress-track" style={{ marginBottom: 12 }}>
          <div className="progress-fill" style={{ width: `${subtaskPct}%` }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {subtasks.map((sub) => (
            <label
              key={sub.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 6,
                backgroundColor: "var(--bg-subtle)",
                cursor: "pointer",
                textDecoration: sub.done ? "line-through" : "none",
                color: sub.done ? "var(--text-muted)" : "var(--text-primary)",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(sub.done)}
                disabled={!allowedToEdit}
                onChange={() => toggleSubtask(task.id, sub.id, !sub.done)}
              />
              <span style={{ fontSize: 13 }}>{sub.text}</span>
            </label>
          ))}
        </div>

        {allowedToEdit && (
        <form onSubmit={handleAddSubtask} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Add a checklist item..."
            value={subtaskText}
            onChange={(e) => setSubtaskText(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Add Item
          </button>
        </form>
        )}
      </div>

      {/* Time Tracking (Requirement #20) */}
      <div className="card" style={{ marginBottom: 18, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
            <Clock size={15} /> Time Tracking
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>
            {task.timeLogged || 0}h logged / {task.estimate || 0}h estimated
          </span>
        </div>

        <div className="progress-track" style={{ marginBottom: 12 }}>
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(
                100,
                task.estimate ? Math.round(((task.timeLogged || 0) / task.estimate) * 100) : 0
              )}%`,
            }}
          />
        </div>

        {allowedToMove && (
        <form onSubmit={handleLogTime} style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            step="0.5"
            min="0.5"
            className="form-input"
            placeholder="Hours spent (e.g. 2.5)"
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Log Hours
          </button>
        </form>
        )}
      </div>

      {/* File Attachments (Requirement #17) */}
      <div className="card" style={{ marginBottom: 18, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
            <Paperclip size={15} /> Attachments ({(task.attachments || []).length})
          </div>
          <label className="btn btn-secondary btn-sm" style={{ cursor: uploading ? "wait" : "pointer" }}>
            {uploading ? "Uploading..." : "Upload File"}
            <input type="file" style={{ display: "none" }} onChange={handleFileSelect} disabled={uploading} />
          </label>
        </div>

        {(task.attachments || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {task.attachments.map((att) => {
              const canRemove = isManager || att.uploadedBy === currentUser?.id;
              return (
              <div
                key={att.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  borderRadius: 6,
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px solid var(--border-color)",
                  fontSize: 12.5,
                }}
              >
                {att.publicId ? <Paperclip size={13} /> : <Link2 size={13} />}
                <button
                  type="button"
                  className="btn-link"
                  style={{ fontSize: 12.5 }}
                  title={att.publicId ? "Download (link valid for 5 minutes)" : att.url}
                  onClick={() => openAttachment(task.id, att.id)}
                >
                  {att.name}
                </button>
                {att.size ? <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{formatBytes(att.size)}</span> : null}
                {canRemove && (
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 20, height: 20 }}
                    title="Remove attachment"
                    aria-label={`Remove ${att.name}`}
                    onClick={() => {
                      if (window.confirm(`Remove "${att.name}"?`)) deleteAttachment(task.id, att.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleAddLink} style={{ display: "flex", gap: 8 }}>
          <input
            type="url"
            className="form-input"
            placeholder="Or paste a link (e.g. a Google Doc or Figma URL)..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm">
            Add Link
          </button>
        </form>
      </div>

      {/* Comments & @Mentions (Requirements #15 & #16) */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
          <MessageSquare size={15} /> Discussion & @Mentions ({(task.comments || []).length})
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {(task.comments || []).map((c) => {
            const author = users.find((u) => u.id === c.userId);
            return (
              <div
                key={c.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: "var(--bg-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <UserAvatar user={author} size={22} />
                    <strong style={{ fontSize: 12.5 }}>{author?.name || "Member"}</strong>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDateTime(c.date)}</span>
                </div>
                <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{c.text}</div>
              </div>
            );
          })}
          {(task.comments || []).length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              No comments yet. Mention teammates with @Name to notify them.
            </div>
          )}
        </div>

        {/* Quick @Mention Insertion Pills */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <AtSign size={12} /> Mention:
          </span>
          {projectMembers.map((u) => (
            <button
              key={u.id}
              type="button"
              className="tag-chip"
              style={{ cursor: "pointer" }}
              onClick={() => insertMention(u.name)}
            >
              @{u.name}
            </button>
          ))}
        </div>

        <form onSubmit={handlePostComment} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Write a comment... Use @Full Name to notify a teammate"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            <Send size={14} /> Post
          </button>
        </form>
      </div>
    </Drawer>
  );
}
