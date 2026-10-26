import React, { useState } from "react";
import { ShieldAlert, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { PriorityBadge, UserAvatar, EmptyState } from "../ui/Primitives";

export function RisksTab({ project }) {
  const {
    users,
    canManageProject,
    createRisk,
    deleteRisk,
  } = useApp();

  const manageable = canManageProject(project);
  const risks = project.risks || [];

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [probability, setProbability] = useState("Medium");
  const [impact, setImpact] = useState("High");
  const [mitigation, setMitigation] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const projectMembers = users.filter((u) => (project.memberIds || []).includes(u.id));

  const handleAddRisk = async (e) => {
    e.preventDefault();
    if (!title.trim() || !mitigation.trim()) return;
    const created = await createRisk(project.id, {
      title: title.trim(),
      probability,
      impact,
      mitigation: mitigation.trim(),
      ownerId: ownerId || null,
    });
    if (!created) return;
    setTitle("");
    setMitigation("");
    setShowForm(false);
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
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldAlert size={18} color="var(--danger)" />
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              Project Risk Register ({risks.length})
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
              Track project risks, probability, impact severity, mitigation plans, and responsible owners.
            </p>
          </div>
        </div>

        {manageable && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus size={15} /> {showForm ? "Cancel" : "Log Risk"}
          </button>
        )}
      </div>

      {showForm && manageable && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 12px" }}>Log New Project Risk</h4>
          <form onSubmit={handleAddRisk}>
            <div className="form-group">
              <label className="form-label">Risk Description / Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Payment gateway rate-limiting during flash sales"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Probability</label>
                <select
                  className="form-select"
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Impact Severity</label>
                <select
                  className="form-select"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Responsible Owner</label>
                <select
                  className="form-select"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mitigation Plan *</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Steps to prevent or mitigate this risk..."
                value={mitigation}
                onChange={(e) => setMitigation(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-sm">
              Save Risk
            </button>
          </form>
        </div>
      )}

      {risks.length === 0 ? (
        <EmptyState
          title="No project risks logged"
          description="Record potential technical, schedule, or vendor risks along with mitigation plans."
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Risk</th>
                <th>Probability</th>
                <th>Impact</th>
                <th>Mitigation Plan</th>
                <th>Owner</th>
                {manageable && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => {
                const owner = users.find((u) => u.id === r.ownerId);
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.title}</td>
                    <td>
                      <PriorityBadge priority={r.probability || "Medium"} />
                    </td>
                    <td>
                      <PriorityBadge priority={r.impact || "High"} />
                    </td>
                    <td style={{ maxWidth: 340 }}>{r.mitigation || "—"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <UserAvatar user={owner} size={24} />
                        <span>{owner ? owner.name : "Unassigned"}</span>
                      </div>
                    </td>
                    {manageable && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteRisk(project.id, r.id)}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </td>
                    )}
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
