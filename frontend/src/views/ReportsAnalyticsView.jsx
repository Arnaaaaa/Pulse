import React, { useState } from "react";
import {
  BarChart3,
  Download,
  Printer,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Star,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { STATUSES, PRIORITIES, isTaskOverdue } from "../constants/seedMeta";
import {
  exportTasksToCSV,
  exportProjectsToCSV,
  triggerPrintPDF,
} from "../utils/exportUtils";
import { UserAvatar, RoleBadge, StatusBadge } from "../components/ui/Primitives";

export function ReportsAnalyticsView({ fixedProjectId = null }) {
  const { projects, tasks, users } = useApp();
  const [selectedProjectId, setSelectedProjectId] = useState(fixedProjectId || "All");

  const activeFilterId = fixedProjectId || selectedProjectId;
  const scopedProjects =
    activeFilterId === "All"
      ? projects
      : projects.filter((p) => p.id === activeFilterId);
  const scopedTasks =
    activeFilterId === "All"
      ? tasks
      : tasks.filter((t) => t.projectId === activeFilterId);

  const totalTasks = scopedTasks.length;
  const completedTasks = scopedTasks.filter((t) => t.status === "Completed").length;
  const overdueTasks = scopedTasks.filter((t) => isTaskOverdue(t)).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const overdueRate = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  const totalEstimatedHrs = scopedTasks.reduce((acc, t) => acc + (Number(t.estimate) || 0), 0);
  const totalLoggedHrs = scopedTasks.reduce((acc, t) => acc + (Number(t.timeLogged) || 0), 0);
  const avgHoursPerCompleted =
    completedTasks > 0
      ? (
          scopedTasks
            .filter((t) => t.status === "Completed")
            .reduce((acc, t) => acc + (Number(t.timeLogged) || Number(t.estimate) || 0), 0) /
          completedTasks
        ).toFixed(1)
      : "0.0";

  // Team Workload Calculation (Requirement #26)
  const workloadRows = users.map((u) => {
    const memberTasks = scopedTasks.filter((t) => t.assigneeId === u.id);
    const active = memberTasks.filter((t) => t.status !== "Completed");
    const done = memberTasks.filter((t) => t.status === "Completed");
    const openEstimate = active.reduce((sum, t) => sum + (Number(t.estimate) || 0), 0);
    const logged = memberTasks.reduce((sum, t) => sum + (Number(t.timeLogged) || 0), 0);
    const overloaded = active.length >= 4 || openEstimate >= 24;
    const avgRating =
      (u.ratings || []).length > 0
        ? (
            u.ratings.reduce((s, r) => s + Number(r.rating), 0) / u.ratings.length
          ).toFixed(1)
        : null;

    return {
      user: u,
      total: memberTasks.length,
      activeCount: active.length,
      doneCount: done.length,
      openEstimate,
      logged,
      overloaded,
      avgRating,
    };
  });

  return (
    <div>
      {/* Toolbar */}
      <div
        className="card no-print"
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BarChart3 size={18} color="var(--brand)" />
          <strong>Analytics, Workload & Exportable Reports</strong>
          {!fixedProjectId && (
            <select
              className="form-select"
              style={{ width: 220 }}
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="All">All Visible Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => exportTasksToCSV(scopedTasks, projects, users)}
          >
            <Download size={14} /> Export Tasks CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => exportProjectsToCSV(scopedProjects, tasks)}
          >
            <Download size={14} /> Export Projects CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={triggerPrintPDF}
          >
            <Printer size={14} /> Print / Save PDF Report
          </button>
        </div>
      </div>

      {/* KPI Analytics Cards (Requirement #27) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-label">Task Completion Rate</div>
            <div className="kpi-value" style={{ color: "var(--success)" }}>
              {completionRate}%
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {completedTasks} of {totalTasks} tasks completed
            </div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--success-soft)", color: "var(--success)" }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Overdue Task Percentage</div>
            <div
              className="kpi-value"
              style={{ color: overdueRate > 0 ? "var(--danger)" : "var(--text-primary)" }}
            >
              {overdueRate}%
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {overdueTasks} overdue open task(s)
            </div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-label">Total Time Logged vs. Est.</div>
            <div className="kpi-value">
              {totalLoggedHrs}h / {totalEstimatedHrs}h
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              Avg {avgHoursPerCompleted}h per completed task
            </div>
          </div>
          <div className="kpi-icon" style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}>
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Status & Priority Distribution Breakdown */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Workflow Stage Distribution</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {STATUSES.map((st) => {
              const count = scopedTasks.filter((t) => t.status === st).length;
              const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
              return (
                <div key={st}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <StatusBadge status={st} />
                    <strong>
                      {count} tasks ({pct}%)
                    </strong>
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
            <h3 className="card-title">Priority Breakdown & Sprint Velocity</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PRIORITIES.map((pr) => {
              const count = scopedTasks.filter((t) => t.priority === pr).length;
              const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
              return (
                <div key={pr}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{pr} Priority</span>
                    <strong>
                      {count} tasks ({pct}%)
                    </strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team Workload Tracking Table (Requirement #26) */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={17} /> Team Workload Distribution & Capacity Tracking
          </h3>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Role</th>
                <th>Active Tasks</th>
                <th>Completed</th>
                <th>Open Estimated Hours</th>
                <th>Hours Logged</th>
                <th>Avg Rating</th>
                <th>Capacity Status</th>
              </tr>
            </thead>
            <tbody>
              {workloadRows.map((row) => (
                <tr key={row.user.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <UserAvatar user={row.user} size={28} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{row.user.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                          {row.user.title}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <RoleBadge role={row.user.role} />
                  </td>
                  <td>
                    <strong>{row.activeCount}</strong>
                  </td>
                  <td>{row.doneCount}</td>
                  <td>{row.openEstimate}h</td>
                  <td>{row.logged}h</td>
                  <td>
                    {row.avgRating ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#f59e0b" }}>
                        <Star size={13} fill="#f59e0b" /> {row.avgRating}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {row.overloaded ? (
                      <span className="badge badge-priority-critical">
                        Overloaded ({row.openEstimate}h open)
                      </span>
                    ) : row.activeCount === 0 ? (
                      <span className="badge badge-status-todo">Available</span>
                    ) : (
                      <span className="badge badge-status-completed">Balanced</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sprint Performance Summary (Requirement #27 & #33) */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Sprint Performance & Project Progress Report</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {scopedProjects.map((p) =>
            (p.sprints || []).map((s) => {
              const sTasks = tasks.filter((t) => t.projectId === p.id && t.sprintId === s.id);
              const sDone = sTasks.filter((t) => t.status === "Completed").length;
              const sPct = sTasks.length > 0 ? Math.round((sDone / sTasks.length) * 100) : 0;
              return (
                <div
                  key={s.id}
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-subtle)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <strong>{s.name}</strong>
                    <StatusBadge status={s.status} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                    {p.name} • {s.start} → {s.end}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span>Sprint Velocity</span>
                    <strong>
                      {sDone}/{sTasks.length} tasks ({sPct}%)
                    </strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${sPct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
