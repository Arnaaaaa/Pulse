import React, { useState } from "react";
import {
  Flag,
  Megaphone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Send,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { todayISO, addDays, isTaskOverdue, formatDateTime } from "../../constants/seedMeta";
import { StatusBadge, TagChip, UserAvatar } from "../ui/Primitives";

export function ProjectOverviewTab({ project }) {
  const {
    tasks,
    users,
    activity,
    canManageProject,
    updateProject,
    postAnnouncement,
    setActiveTaskId,
  } = useApp();

  const manageable = canManageProject(project);
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const completedCount = projectTasks.filter((t) => t.status === "Completed").length;
  const pendingCount = projectTasks.length - completedCount;
  const overdueCount = projectTasks.filter((t) => isTaskOverdue(t)).length;
  const progressPct =
    projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;

  const projectActivity = activity.filter((a) => a.projectId === project.id);

  // Milestone form state
  const [msName, setMsName] = useState("");
  const [msDate, setMsDate] = useState(addDays(todayISO(), 14));

  // Announcement form state
  const [annText, setAnnText] = useState("");

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    if (!msName.trim()) return;
    const newMs = {
      name: msName.trim(),
      date: msDate || todayISO(),
      done: false,
    };
    const updated = await updateProject(project.id, {
      milestones: [...(project.milestones || []), newMs],
    });
    if (updated) setMsName("");
  };

  const handleToggleMilestone = async (msId) => {
    if (!manageable) return;
    const updated = (project.milestones || []).map((m) =>
      m.id === msId ? { ...m, done: !m.done } : m
    );
    await updateProject(project.id, { milestones: updated });
  };

  const handleDeleteMilestone = async (msId) => {
    if (!manageable) return;
    const updated = (project.milestones || []).filter((m) => m.id !== msId);
    await updateProject(project.id, { milestones: updated });
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!annText.trim()) return;
    if (await postAnnouncement(project.id, annText.trim())) setAnnText("");
  };

  return (
    <div>
      {/* Project Dashboard KPI Row (Requirement #25) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Overall Project Progress</div>
            <div className="kpi-value">{progressPct}%</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {project.startDate} → {project.endDate}
            </div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Completed Tasks</div>
            <div className="kpi-value" style={{ color: "var(--success)" }}>
              {completedCount}
            </div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--success-soft)", color: "var(--success)" }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Pending / In-Flight Tasks</div>
            <div className="kpi-value">{pendingCount}</div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--warning-soft)", color: "var(--warning)" }}>
            <Clock size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Overdue Tasks</div>
            <div
              className="kpi-value"
              style={{ color: overdueCount > 0 ? "var(--danger)" : undefined }}
            >
              {overdueCount}
            </div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}>
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Project Description & Progress Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Project Summary & Scope</h3>
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13.5 }}>
              {project.description || "No description provided."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(project.tags || []).map((t) => (
              <TagChip key={t} tag={t} />
            ))}
          </div>
        </div>

        <div className="progress-track" style={{ height: 10, marginTop: 12 }}>
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Milestones & Announcements Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
          marginBottom: 20,
        }}
      >
        {/* Milestones Card (Requirement #11) */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Flag size={16} color="var(--purple)" /> Project Milestones ({(project.milestones || []).length})
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {(project.milestones || []).map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 8,
                  backgroundColor: "var(--bg-subtle)",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: manageable ? "pointer" : "default",
                    textDecoration: m.done ? "line-through" : "none",
                    color: m.done ? "var(--text-muted)" : "var(--text-primary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(m.done)}
                    disabled={!manageable}
                    onChange={() => handleToggleMilestone(m.id)}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      Target: {m.date}
                    </div>
                  </div>
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StatusBadge status={m.done ? "Completed" : "Planned"} />
                  {manageable && (
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 26, height: 26 }}
                      onClick={() => handleDeleteMilestone(m.id)}
                      title="Delete milestone"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(project.milestones || []).length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No milestones defined yet.
              </div>
            )}
          </div>

          {manageable && (
            <form onSubmit={handleAddMilestone} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: 1, minWidth: 160 }}
                placeholder="New milestone name..."
                value={msName}
                onChange={(e) => setMsName(e.target.value)}
              />
              <input
                type="date"
                className="form-input"
                style={{ width: 145 }}
                value={msDate}
                onChange={(e) => setMsDate(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm">
                <Plus size={14} /> Add
              </button>
            </form>
          )}
        </div>

        {/* Project Announcements Card (Requirement #29) */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Megaphone size={16} color="var(--brand)" /> Project Announcements ({(project.announcements || []).length})
            </h3>
          </div>

          {manageable && (
            <form onSubmit={handlePostAnnouncement} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Publish an update for the team..."
                value={annText}
                onChange={(e) => setAnnText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                <Send size={14} /> Publish
              </button>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(project.announcements || []).map((ann) => {
              const author = users.find((u) => u.id === ann.authorId);
              return (
                <div
                  key={ann.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: "var(--bg-subtle)",
                    borderLeft: "3px solid var(--brand)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <UserAvatar user={author} size={22} />
                      <strong style={{ fontSize: 12.5 }}>{author?.name || "Manager"}</strong>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDateTime(ann.date)}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>{ann.text}</div>
                </div>
              );
            })}
            {(project.announcements || []).length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No project announcements published yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Project Deadlines & Recent Activity */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
        }}
      >
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Upcoming Task Deadlines</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projectTasks
              .filter((t) => t.status !== "Completed")
              .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
              .slice(0, 6)
              .map((t) => {
                const assignee = users.find((u) => u.id === t.assigneeId);
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 6,
                      backgroundColor: "var(--bg-subtle)",
                      cursor: "pointer",
                    }}
                    onClick={() => setActiveTaskId(t.id)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.title}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        Due {t.dueDate || "—"} • {assignee?.name || "Unassigned"}
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                );
              })}
            {projectTasks.filter((t) => t.status !== "Completed").length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                All tasks in this project are completed!
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Project Activity Timeline</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projectActivity.slice(0, 7).map((a) => {
              const actor = users.find((u) => u.id === a.userId);
              return (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12.5,
                    paddingBottom: 6,
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  <div>
                    <strong>{actor?.name || "Former member"}</strong> {a.action}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDateTime(a.createdAt)}</span>
                </div>
              );
            })}
            {projectActivity.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No activity recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
