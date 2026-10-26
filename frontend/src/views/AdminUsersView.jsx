import React, { useState } from "react";
import { ShieldAlert, Star, UserPlus } from "lucide-react";
import { useApp } from "../context/AppContext";
import { ROLES } from "../constants/seedMeta";
import { UserAvatar, RoleBadge } from "../components/ui/Primitives";

export function AdminUsersView() {
  const { allUsers, currentUser, updateUser, createEmployee } = useApp();

  const isAdmin = currentUser?.role === "Admin";

  // New employee form: the admin enters name, email and role; the employee then
  // signs in with "First time here?" to receive a code and set their password.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Team Member");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    const created = await createEmployee({ name: name.trim(), email: email.trim(), role, title: title.trim() || undefined });
    setSubmitting(false);
    if (created) {
      setName("");
      setEmail("");
      setTitle("");
      setRole("Team Member");
    }
  };

  if (!isAdmin) {
    return (
      <div className="card">
        <p style={{ margin: 0 }}>Only administrators can manage employees.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <ShieldAlert size={20} color="var(--purple)" />
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Employees & Roles</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
              Add new employees here. They sign in with <strong>First time here?</strong> using the same name and email,
              receive a code by email, and choose their own password.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="emp-name">Full name *</label>
              <input id="emp-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="emp-email">Work email *</label>
              <input id="emp-email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="emp-role">Role *</label>
              <select id="emp-role" className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="emp-title">Job title</label>
              <input id="emp-title" className="form-input" placeholder="e.g. QA Engineer" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            <UserPlus size={14} /> {submitting ? "Adding..." : "Add employee"}
          </button>
        </form>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Title</th>
              <th>Role</th>
              <th>Sign-in</th>
              <th>Performance Ratings</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => {
              const ratings = u.ratings || [];
              const avg =
                ratings.length > 0
                  ? (ratings.reduce((sum, r) => sum + Number(r.rating), 0) / ratings.length).toFixed(1)
                  : null;
              const isSelf = u.id === currentUser.id;
              const inactive = u.active === false;

              return (
                <tr key={u.id} style={inactive ? { opacity: 0.6 } : undefined}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <UserAvatar user={u} size={30} />
                      <strong>{u.name}</strong>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <input
                      type="text"
                      className="form-input"
                      style={{ maxWidth: 180 }}
                      defaultValue={u.title}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== u.title) updateUser(u.id, { title: value });
                      }}
                    />
                  </td>
                  <td>
                    {isSelf ? (
                      <RoleBadge role={u.role} />
                    ) : (
                      <select
                        className="form-select"
                        style={{ maxWidth: 180 }}
                        value={u.role}
                        onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    {u.isPasswordSet ? (
                      <span className="badge badge-status-completed">Password set</span>
                    ) : (
                      <span className="badge badge-status-todo">Invited</span>
                    )}
                  </td>
                  <td>
                    {avg ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#f59e0b" }}>
                        <Star size={14} fill="#f59e0b" /> {avg} ({ratings.length} review{ratings.length > 1 ? "s" : ""})
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>No ratings yet</span>
                    )}
                  </td>
                  <td>
                    {isSelf ? (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>You</span>
                    ) : (
                      <button
                        type="button"
                        className={`btn btn-sm ${inactive ? "btn-secondary" : "btn-danger"}`}
                        onClick={() => {
                          if (inactive || window.confirm(`Deactivate ${u.name}? They will be signed out and lose access.`)) {
                            updateUser(u.id, { active: inactive });
                          }
                        }}
                      >
                        {inactive ? "Reactivate" : "Deactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
