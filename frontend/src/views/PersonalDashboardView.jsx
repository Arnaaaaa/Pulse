import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListChecks,
  FolderKanban,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { isTaskOverdue, isTaskApproaching, formatDateTime } from "../constants/seedMeta";
import {
  StatusBadge,
  PriorityBadge,
  RoleBadge,
  TagChip,
  EmptyState,
} from "../components/ui/Primitives";

export function PersonalDashboardView() {
  const {
    currentUser,
    projects,
    tasks,
    activity,
    users,
    navigate,
    setActiveTaskId,
    changeTaskStatus,
    canManageProject,
  } = useApp();

  const [bucket, setBucket] = useState("assigned"); // "assigned" | "upcoming" | "overdue" | "completed"

  const myTasks = tasks.filter((t) => t.assigneeId === currentUser?.id);
  const activeAssigned = myTasks.filter((t) => t.status !== "Completed");
  // Due within the next 7 days (overdue ones have their own bucket)
  const upcomingTasks = myTasks
    .filter((t) => isTaskApproaching(t, 7))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdueTasks = myTasks.filter((t) => isTaskOverdue(t));
  const completedTasks = myTasks.filter((t) => t.status === "Completed");

  // Tasks awaiting manager review across projects currentUser manages
  const reviewQueue = tasks.filter((t) => {
    if (t.status !== "Under Review") return false;
    const proj = projects.find((p) => p.id === t.projectId);
    return canManageProject(proj);
  });

  const bucketList =
    bucket === "assigned"
      ? activeAssigned
      : bucket === "upcoming"
      ? upcomingTasks
      : bucket === "overdue"
      ? overdueTasks
      : completedTasks;

  return (
    <div>
      {/* Welcome Banner */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 19 }}>
              Welcome back, {currentUser?.name}
            </h2>
            <RoleBadge role={currentUser?.role} />
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>
            You have {activeAssigned.length} open task(s) and {overdueTasks.length} overdue item(s) across {projects.length} visible project(s).
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigate("projects")}
        >
          View All Projects <ArrowRight size={14} />
        </button>
      </div>

      {/* KPI Summary Cards (Requirement #24) */}
      <div className="kpi-grid">
        <div
          className="kpi-card"
          style={{ cursor: "pointer" }}
          onClick={() => setBucket("assigned")}
        >
          <div>
            <div className="kpi-label">Active Assigned</div>
            <div className="kpi-value">{activeAssigned.length}</div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}>
            <ListChecks size={22} />
          </div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: "pointer" }}
          onClick={() => setBucket("upcoming")}
        >
          <div>
            <div className="kpi-label">Upcoming Deadlines</div>
            <div className="kpi-value">{upcomingTasks.length}</div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--warning-soft)", color: "var(--warning)" }}>
            <Clock size={22} />
          </div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: "pointer" }}
          onClick={() => setBucket("overdue")}
        >
          <div>
            <div className="kpi-label">Overdue Tasks</div>
            <div className="kpi-value" style={{ color: overdueTasks.length > 0 ? "var(--danger)" : undefined }}>
              {overdueTasks.length}
            </div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        <div
          className="kpi-card"
          style={{ cursor: "pointer" }}
          onClick={() => setBucket("completed")}
        >
          <div>
            <div className="kpi-label">Completed by Me</div>
            <div className="kpi-value" style={{ color: "var(--success)" }}>
              {completedTasks.length}
            </div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--success-soft)", color: "var(--success)" }}>
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Manager Approval / Review Queue (Requirement #31) */}
      {reviewQueue.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--warning)" }}>
          <div className="card-header">
            <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ClipboardCheck size={18} color="var(--warning)" />
              Awaiting Your Review & Approval ({reviewQueue.length})
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reviewQueue.map((t) => {
              const assignee = users.find((u) => u.id === t.assigneeId);
              const proj = projects.find((p) => p.id === t.projectId);
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    backgroundColor: "var(--bg-subtle)",
                  }}
                >
                  <div
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTaskId(t.id)}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {proj?.name} • Submitted by {assignee?.name || "Unassigned"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => changeTaskStatus(t, "In Progress")}
                    >
                      Request Changes
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => changeTaskStatus(t, "Completed")}
                    >
                      Approve & Complete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Split Grid: Personal Tasks + Active Projects & Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        {/* Left: Personal Tasks Tabs */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">My Work Items</h3>
          </div>

          <div className="tabs-bar" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={`tab-btn ${bucket === "assigned" ? "active" : ""}`}
              onClick={() => setBucket("assigned")}
            >
              Assigned ({activeAssigned.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${bucket === "upcoming" ? "active" : ""}`}
              onClick={() => setBucket("upcoming")}
            >
              Upcoming ({upcomingTasks.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${bucket === "overdue" ? "active" : ""}`}
              onClick={() => setBucket("overdue")}
            >
              Overdue ({overdueTasks.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${bucket === "completed" ? "active" : ""}`}
              onClick={() => setBucket("completed")}
            >
              Completed ({completedTasks.length})
            </button>
          </div>

          {bucketList.length === 0 ? (
            <EmptyState
              title={`No ${bucket} tasks`}
              description="Click any project to explore the Kanban board or create a new task."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bucketList.map((t) => {
                const proj = projects.find((p) => p.id === t.projectId);
                return (
                  <div
                    key={t.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--bg-subtle)",
                      cursor: "pointer",
                    }}
                    onClick={() => setActiveTaskId(t.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t.title}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 8,
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      <span>
                        {proj?.name} • Due {t.dueDate || "—"}
                      </span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    {(t.tags || []).length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        {t.tags.map((tg) => (
                          <TagChip key={tg} tag={tg} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Projects & Recent Activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FolderKanban size={17} /> Active Projects ({projects.length})
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {projects.map((p) => {
                const pTasks = tasks.filter((t) => t.projectId === p.id);
                const done = pTasks.filter((t) => t.status === "Completed").length;
                const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("project-detail", p.id, "overview")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <strong style={{ fontSize: 14 }}>{p.name}</strong>
                      <StatusBadge status={p.status} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                      <span>Template: {p.template || "Custom"}</span>
                      <span>
                        {done}/{pTasks.length} tasks ({pct}%)
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Workspace Activity</h3>
              <button
                type="button"
                className="btn-link"
                onClick={() => navigate("audit")}
              >
                Full Audit Trail
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {activity.slice(0, 6).map((a) => {
                const actor = users.find((u) => u.id === a.userId);
                const proj = projects.find((p) => p.id === a.projectId);
                return (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 12.5,
                      paddingBottom: 8,
                      borderBottom: "1px solid var(--border-color)",
                    }}
                  >
                    <div>
                      <strong>{actor?.name || "User"}</strong> {a.action}
                      {proj && (
                        <span style={{ color: "var(--text-muted)" }}> in {proj.name}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDateTime(a.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
