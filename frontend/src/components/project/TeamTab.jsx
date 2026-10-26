import React, { useState } from "react";
import { UserPlus, UserMinus, Star, Users } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { ROLES } from "../../constants/seedMeta";
import { UserAvatar, RoleBadge } from "../ui/Primitives";

export function TeamTab({ project }) {
  const {
    users,
    tasks,
    currentUser,
    canManageProject,
    addProjectMember,
    removeProjectMember,
    updateUser,
    setRatingModalProject,
  } = useApp();

  const manageable = canManageProject(project);
  const isAdmin = currentUser?.role === "Admin";
  const [selectedUserId, setSelectedUserId] = useState("");

  const members = (project.memberIds || [])
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean);

  const nonMembers = users.filter((u) => u.role === "Team Member" && !(project.memberIds || []).includes(u.id));
  const projectTasks = tasks.filter((t) => t.projectId === project.id);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    await addProjectMember(project.id, selectedUserId);
    setSelectedUserId("");
  };

  return (
    <div>
      {/* Header & Add Member Form */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={18} color="var(--brand)" />
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              Project Team & Workload ({members.length} Members)
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
              Manage project members, assign roles, and monitor task distribution across the team.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {manageable && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRatingModalProject(project)}
            >
              <Star size={14} /> Rate Team Members
            </button>
          )}

          {manageable && nonMembers.length > 0 && (
            <form onSubmit={handleAddMember} style={{ display: "flex", gap: 8 }}>
              <select
                className="form-select"
                style={{ width: 210 }}
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">Select user to add...</option>
                {nonMembers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary btn-sm">
                <UserPlus size={14} /> Add Member
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Team Members Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {members.map((m) => {
          const memberTasks = projectTasks.filter((t) => t.assigneeId === m.id);
          const openTasks = memberTasks.filter((t) => t.status !== "Completed");
          const doneTasks = memberTasks.filter((t) => t.status === "Completed");
          const openHours = openTasks.reduce((s, t) => s + (Number(t.estimate) || 0), 0);
          const loggedHours = memberTasks.reduce((s, t) => s + (Number(t.timeLogged) || 0), 0);
          const overloaded = openTasks.length >= 4 || openHours >= 24;
          const ratings = m.ratings || [];
          const avgRating =
            ratings.length > 0
              ? (
                  ratings.reduce((sum, r) => sum + Number(r.rating), 0) / ratings.length
                ).toFixed(1)
              : null;

          return (
            <div key={m.id} className="card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <UserAvatar user={m} size={40} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {m.title} • {m.email}
                    </div>
                  </div>
                </div>

                {manageable && (
                  <button
                    type="button"
                    className="icon-btn"
                    title="Remove from project"
                    onClick={() => removeProjectMember(project.id, m.id)}
                  >
                    <UserMinus size={15} />
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                {isAdmin ? (
                  <select
                    className="form-select"
                    style={{ width: 160, padding: "4px 8px", fontSize: 12 }}
                    value={m.role}
                    onChange={(e) => updateUser(m.id, { role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}

                {avgRating && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: "#f59e0b" }}>
                    <Star size={14} fill="#f59e0b" /> {avgRating}
                  </span>
                )}
              </div>

              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: "var(--bg-subtle)",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>Assigned Project Workload</span>
                  <strong>
                    {openTasks.length} active / {doneTasks.length} done
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                  <span>Open Est: {openHours}h • Logged: {loggedHours}h</span>
                  {overloaded ? (
                    <span style={{ color: "var(--danger)", fontWeight: 700 }}>
                      Overloaded
                    </span>
                  ) : (
                    <span style={{ color: "var(--success)", fontWeight: 600 }}>
                      Healthy
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
