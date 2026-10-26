import React from "react";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Calendar,
  BarChart3,
  History,
  ShieldAlert,
  Layers,
  Plus,
  X,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { RoleBadge, UserAvatar } from "../ui/Primitives";

export function Sidebar({ mobileOpen, onCloseMobile }) {
  const {
    currentUser,
    projects,
    route,
    navigate,
    canCreateProject,
    setProjectModalState,
  } = useApp();

  const navItems = [
    { id: "dashboard", label: "My Dashboard", icon: LayoutDashboard },
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "tasks", label: "Tasks & Bugs", icon: CheckSquare },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "reports", label: "Analytics & Reports", icon: BarChart3 },
    { id: "audit", label: "Audit Trail", icon: History },
  ];

  if (currentUser?.role === "Admin") {
    navItems.push({ id: "admin", label: "Admin & Roles", icon: ShieldAlert });
  }

  const handleNav = (page, projectId = null, tab = "overview") => {
    navigate(page, projectId, tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={onCloseMobile} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Layers size={20} />
          </div>
          <div>
            <div className="brand-name">PULSE</div>
            <div className="brand-subtitle">Project Updates, Logistics &amp; Scheduling Engine</div>
          </div>
          <button
            type="button"
            className="icon-btn sidebar-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = route.page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-link ${active ? "active" : ""}`}
                onClick={() => handleNav(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="sidebar-section-header">
            <span className="sidebar-section-label">Projects ({projects.length})</span>
            {canCreateProject && (
              <button
                type="button"
                className="icon-btn-sm"
                title="New Project"
                onClick={() => {
                  setProjectModalState({ open: true, editProject: null });
                  if (onCloseMobile) onCloseMobile();
                }}
              >
                <Plus size={15} />
              </button>
            )}
          </div>

          <div className="sidebar-projects-list">
            {projects.map((p) => {
              const isSelected = route.page === "project-detail" && route.projectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`sidebar-project-item ${isSelected ? "active" : ""}`}
                  onClick={() => handleNav("project-detail", p.id, "overview")}
                >
                  <span
                    className={`project-dot status-dot-${(p.status || "Active").toLowerCase()}`}
                  />
                  <span className="project-item-name">{p.name}</span>
                  <span className="project-item-status">{p.status}</span>
                </button>
              );
            })}
            {projects.length === 0 && (
              <div className="sidebar-empty-hint">No visible projects yet</div>
            )}
          </div>
        </nav>

        {currentUser && (
          <div className="sidebar-footer">
            <UserAvatar user={currentUser} size={36} />
            <div className="sidebar-user-meta">
              <div className="sidebar-user-name">{currentUser.name}</div>
              <div className="sidebar-user-role">
                <RoleBadge role={currentUser.role} />
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
