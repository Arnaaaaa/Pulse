import React, { useState } from "react";
import { History, Download } from "lucide-react";
import { useApp } from "../context/AppContext";
import { downloadCSV } from "../utils/exportUtils";
import { formatDateTime } from "../constants/seedMeta";
import { UserAvatar, EmptyState } from "../components/ui/Primitives";

export function AuditTrailView({ fixedProjectId = null }) {
  const { activity, projects, users } = useApp();
  const [projectFilter, setProjectFilter] = useState(fixedProjectId || "All");
  const [userFilter, setUserFilter] = useState("All");
  const [search, setSearch] = useState("");

  const activeProjId = fixedProjectId || projectFilter;

  const filtered = activity.filter((a) => {
    if (activeProjId !== "All" && a.projectId !== activeProjId) return false;
    if (userFilter !== "All" && a.userId !== userFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!a.action?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleExportAudit = () => {
    const headers = ["Event ID", "Timestamp", "User", "Role", "Project", "Action", "Details"];
    const rows = filtered.map((a) => {
      const u = users.find((x) => x.id === a.userId);
      const p = projects.find((x) => x.id === a.projectId);
      return [
        a.id,
        a.createdAt,
        u?.name || a.userId,
        u?.role || "",
        p?.name || a.projectId,
        a.action,
        a.details ? JSON.stringify(a.details) : "",
      ];
    });
    downloadCSV("pulse-audit-trail.csv", headers, rows);
  };

  return (
    <div>
      <div
        className="card"
        style={{
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <History size={18} color="var(--brand)" />
          <strong>Audit Trail & Activity Log ({filtered.length})</strong>

          {!fixedProjectId && (
            <select
              className="form-select"
              style={{ width: 200 }}
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
            style={{ width: 180 }}
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          >
            <option value="All">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <input
            type="search"
            className="form-input"
            style={{ width: 220 }}
            placeholder="Filter actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleExportAudit}
        >
          <Download size={14} /> Export Audit CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No activity records found"
          description="Actions performed on projects, tasks, sprints, and team members are logged here automatically."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Actor</th>
                <th>Action Performed</th>
                <th>Project</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const actor = users.find((u) => u.id === a.userId);
                const proj = projects.find((p) => p.id === a.projectId);
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <UserAvatar user={actor} size={26} />
                        <strong>{actor?.name || "Former member"}</strong>
                      </div>
                    </td>
                    <td>{a.action}</td>
                    <td>{proj?.name || a.projectId}</td>
                    <td style={{ color: "var(--text-muted)" }}>{formatDateTime(a.createdAt)}</td>
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
