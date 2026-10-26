import React, { useState } from "react";
import {
  FolderPlus,
  Archive,
  CheckCircle2,
  Edit3,
  Download,
  RotateCcw,
  Calendar,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { exportProjectsToCSV } from "../utils/exportUtils";
import {
  StatusBadge,
  TagChip,
  UserAvatar,
  EmptyState,
} from "../components/ui/Primitives";

export function ProjectsDirectoryView() {
  const {
    projects,
    tasks,
    users,
    canCreateProject,
    canManageProject,
    setProjectModalState,
    updateProjectStatus,
    navigate,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState("All"); // "All" | "Active" | "Completed" | "Archived"
  const [search, setSearch] = useState("");

  const filtered = projects.filter((p) => {
    if (statusFilter !== "All" && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchTag = (p.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!matchName && !matchTag) return false;
    }
    return true;
  });

  return (
    <div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {["All", "Active", "Completed", "Archived"].map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm ${statusFilter === st ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
          <input
            type="search"
            className="form-input"
            style={{ width: 240 }}
            placeholder="Filter projects by name, tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => exportProjectsToCSV(filtered, tasks)}
          >
            <Download size={14} /> Export CSV
          </button>
          {canCreateProject && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setProjectModalState({ open: true, editProject: null })}
            >
              <FolderPlus size={15} /> Create Project
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No projects match your filter"
          description="Create a new project from a predefined template or adjust your status filter."
          actionLabel={canCreateProject ? "Create Project" : undefined}
          onAction={
            canCreateProject
              ? () => setProjectModalState({ open: true, editProject: null })
              : undefined
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 18,
          }}
        >
          {filtered.map((p) => {
            const pTasks = tasks.filter((t) => t.projectId === p.id);
            const done = pTasks.filter((t) => t.status === "Completed").length;
            const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
            const manageable = canManageProject(p);
            const members = (p.memberIds || [])
              .map((id) => users.find((u) => u.id === id))
              .filter(Boolean);

            return (
              <div key={p.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "var(--brand)",
                        }}
                      >
                        {p.template || "Custom"}
                      </span>
                      <h3
                        style={{ margin: "4px 0 6px", fontSize: 17, cursor: "pointer" }}
                        onClick={() => navigate("project-detail", p.id, "overview")}
                      >
                        {p.name}
                      </h3>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px" }}>
                    {p.description || "No description provided."}
                  </p>

                  {(p.tags || []).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {p.tags.map((t) => (
                        <TagChip key={t} tag={t} />
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span>Progress ({done}/{pTasks.length} tasks)</span>
                    <strong>{pct}%</strong>
                  </div>
                  <div className="progress-track" style={{ marginBottom: 12 }}>
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={13} /> {p.startDate} → {p.endDate}
                    </span>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {members.slice(0, 5).map((m) => (
                        <span key={m.id} style={{ marginLeft: -6 }}>
                          <UserAvatar user={m} size={24} showTooltip />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 12,
                    borderTop: "1px solid var(--border-color)",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate("project-detail", p.id, "overview")}
                  >
                    Open Workspace
                  </button>

                  {manageable && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Edit Project"
                        onClick={() => setProjectModalState({ open: true, editProject: p })}
                      >
                        <Edit3 size={14} />
                      </button>
                      {p.status !== "Completed" && (
                        <button
                          type="button"
                          className="icon-btn"
                          title="Mark Project Completed & Rate Team"
                          onClick={() => updateProjectStatus(p.id, "Completed")}
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      {p.status !== "Archived" ? (
                        <button
                          type="button"
                          className="icon-btn"
                          title="Archive Project"
                          onClick={() => updateProjectStatus(p.id, "Archived")}
                        >
                          <Archive size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="icon-btn"
                          title="Reactivate Project"
                          onClick={() => updateProjectStatus(p.id, "Active")}
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
