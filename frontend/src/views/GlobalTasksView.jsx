import React, { useState, useMemo } from "react";
import { Plus, Download, Bug, Filter, RotateCcw } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  STATUSES,
  PRIORITIES,
  TASK_TYPES,
  PRESET_TAGS,
  isTaskOverdue,
} from "../constants/seedMeta";
import { exportTasksToCSV } from "../utils/exportUtils";
import {
  StatusBadge,
  PriorityBadge,
  SeverityBadge,
  TagChip,
  UserAvatar,
  EmptyState,
} from "../components/ui/Primitives";

export function GlobalTasksView({ fixedProjectId = null }) {
  const {
    tasks,
    projects,
    users,
    currentUser,
    globalSearch,
    setGlobalSearch,
    setActiveTaskId,
    setTaskModalState,
  } = useApp();

  const [projectFilter, setProjectFilter] = useState(fixedProjectId || "All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [deadlineFilter, setDeadlineFilter] = useState("All"); // "All" | "Overdue" | "HasDueDate"

  const activeProjectId = fixedProjectId || projectFilter;

  const allTags = useMemo(() => {
    const set = new Set(PRESET_TAGS);
    tasks.forEach((t) => (t.tags || []).forEach((tg) => set.add(tg)));
    return Array.from(set);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeProjectId !== "All" && t.projectId !== activeProjectId) return false;
      if (assigneeFilter !== "All") {
        if (assigneeFilter === "Unassigned" && t.assigneeId) return false;
        if (assigneeFilter !== "Unassigned" && t.assigneeId !== assigneeFilter) return false;
      }
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (priorityFilter !== "All" && t.priority !== priorityFilter) return false;
      if (typeFilter !== "All") {
        if (typeFilter === "BugsOnly" && t.type !== "Bug" && t.type !== "Issue") return false;
        if (typeFilter !== "BugsOnly" && (t.type || "Task") !== typeFilter) return false;
      }
      if (tagFilter !== "All" && !(t.tags || []).includes(tagFilter)) return false;
      if (deadlineFilter === "Overdue" && !isTaskOverdue(t)) return false;

      if (globalSearch.trim()) {
        const q = globalSearch.toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchTag = (t.tags || []).some((tg) => tg.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchTag) return false;
      }
      return true;
    });
  }, [
    tasks,
    activeProjectId,
    assigneeFilter,
    statusFilter,
    priorityFilter,
    typeFilter,
    tagFilter,
    deadlineFilter,
    globalSearch,
  ]);

  const resetFilters = () => {
    if (!fixedProjectId) setProjectFilter("All");
    setAssigneeFilter("All");
    setStatusFilter("All");
    setPriorityFilter("All");
    setTypeFilter("All");
    setTagFilter("All");
    setDeadlineFilter("All");
    setGlobalSearch("");
  };

  return (
    <div>
      {/* Filter & Search Toolbar (Requirement #22) */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={16} color="var(--brand)" />
            <strong>Search & Filter Work Items ({filteredTasks.length})</strong>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className={`btn btn-sm ${typeFilter === "BugsOnly" ? "btn-danger" : "btn-secondary"}`}
              onClick={() => setTypeFilter(typeFilter === "BugsOnly" ? "All" : "BugsOnly")}
            >
              <Bug size={14} /> Bugs & Issues Only
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
              <RotateCcw size={13} /> Reset Filters
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => exportTasksToCSV(filteredTasks, projects, users)}
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setTaskModalState({
                  open: true,
                  defaultProjectId: fixedProjectId || projects[0]?.id,
                  defaultSprintId: null,
                  defaultType: "Bug",
                  editTask: null,
                })
              }
            >
              <Bug size={14} /> Report Bug
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                setTaskModalState({
                  open: true,
                  defaultProjectId: fixedProjectId || projects[0]?.id,
                  defaultSprintId: null,
                  defaultType: "Task",
                  editTask: null,
                })
              }
            >
              <Plus size={14} /> New Task
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
          }}
        >
          {!fixedProjectId && (
            <select
              className="form-select"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="All">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="All">All Assignees</option>
            <option value="Unassigned">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="All">All Types</option>
            <option value="BugsOnly">Bugs & Issues</option>
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="All">All Tags</option>
            {allTags.map((tg) => (
              <option key={tg} value={tg}>
                #{tg}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={deadlineFilter}
            onChange={(e) => setDeadlineFilter(e.target.value)}
          >
            <option value="All">All Deadlines</option>
            <option value="Overdue">Overdue Only</option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          title="No tasks or issues match your filters"
          description="Try resetting filters or create a new task/bug."
          actionLabel="Reset Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title & Tags</th>
                <th>Type</th>
                {!fixedProjectId && <th>Project</th>}
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Due Date</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                const proj = projects.find((p) => p.id === t.projectId);
                const assignee = users.find((u) => u.id === t.assigneeId);
                const overdue = isTaskOverdue(t);

                return (
                  <tr
                    key={t.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveTaskId(t.id)}
                  >
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.title}</div>
                      {(t.tags || []).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                          {t.tags.map((tg) => (
                            <TagChip key={tg} tag={tg} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <span className="badge badge-status-todo">{t.type || "Task"}</span>
                        {t.severity && <SeverityBadge severity={t.severity} />}
                      </div>
                    </td>
                    {!fixedProjectId && <td>{proj?.name || t.projectId}</td>}
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <UserAvatar user={assignee} size={24} />
                        <span>{assignee ? assignee.name : "Unassigned"}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          color: overdue ? "var(--danger)" : undefined,
                          fontWeight: overdue ? 700 : 500,
                        }}
                      >
                        {t.dueDate || "—"} {overdue ? "(Overdue)" : ""}
                      </span>
                    </td>
                    <td>
                      {t.timeLogged || 0}h / {t.estimate || 0}h
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
}
