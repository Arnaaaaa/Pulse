import React from "react";
import { X, AlertCircle, CheckCircle2, Info, Inbox } from "lucide-react";

export function UserAvatar({ user, size = 32, showTooltip = false }) {
  if (!user) {
    return (
      <span
        className="avatar avatar-unassigned"
        style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.4)) }}
        title="Unassigned"
      >
        ?
      </span>
    );
  }
  const initials = (user.name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        backgroundColor: user.color || "#4C5FD5",
        fontSize: Math.max(11, Math.round(size * 0.4)),
      }}
      title={showTooltip ? `${user.name} (${user.role})` : undefined}
    >
      {initials}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    "To Do": "badge-status-todo",
    "In Progress": "badge-status-progress",
    "Under Review": "badge-status-review",
    Completed: "badge-status-completed",
    Active: "badge-status-progress",
    Planned: "badge-status-todo",
    Archived: "badge-status-archived",
  };
  return <span className={`badge ${map[status] || "badge-status-todo"}`}>{status}</span>;
}

export function PriorityBadge({ priority }) {
  const map = {
    Low: "badge-priority-low",
    Medium: "badge-priority-medium",
    High: "badge-priority-high",
    Critical: "badge-priority-critical",
  };
  return <span className={`badge ${map[priority] || "badge-priority-medium"}`}>{priority}</span>;
}

export function SeverityBadge({ severity }) {
  if (!severity) return null;
  const map = {
    Low: "badge-priority-low",
    Medium: "badge-priority-medium",
    High: "badge-priority-high",
    Critical: "badge-priority-critical",
  };
  return <span className={`badge ${map[severity] || "badge-priority-medium"}`}>Sev: {severity}</span>;
}

export function RoleBadge({ role }) {
  const map = {
    Admin: "badge-role-admin",
    "Project Manager": "badge-role-pm",
    "Team Member": "badge-role-member",
  };
  return <span className={`badge ${map[role] || "badge-role-member"}`}>{role}</span>;
}

export function TagChip({ tag, onRemove }) {
  return (
    <span className="tag-chip">
      <span>#{tag}</span>
      {onRemove && (
        <button type="button" className="tag-remove-btn" onClick={() => onRemove(tag)} aria-label={`Remove ${tag}`}>
          <X size={12} />
        </button>
      )}
    </span>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={28} />
      </div>
      <h4 className="empty-state-title">{title}</h4>
      {description && <p className="empty-state-desc">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, width = "580px", children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, width = "640px", children }) {
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="drawer-panel"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer-header">
          <h3 className="drawer-title">{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close drawer">
            <X size={18} />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type || "info"}`}>
          {t.type === "error" ? (
            <AlertCircle size={18} />
          ) : t.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <Info size={18} />
          )}
          <span className="toast-message">{t.message}</span>
          <button type="button" className="toast-close" onClick={() => onDismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
