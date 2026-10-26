import React, { useState, useRef, useEffect } from "react";
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  Plus,
  FolderPlus,
  LogOut,
  CheckCheck,
  Clock,
  AlertTriangle,
  KeyRound,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { UserAvatar } from "../ui/Primitives";
import { formatDateTime } from "../../constants/seedMeta";

export function Topbar({ onOpenMobileSidebar }) {
  const {
    theme,
    toggleTheme,
    currentUser,
    projects,
    route,
    navigate,
    globalSearch,
    setGlobalSearch,
    notifications,
    deadlineReminders,
    markNotificationRead,
    markAllNotificationsRead,
    canCreateProject,
    setTaskModalState,
    setProjectModalState,
    setActiveTaskId,
    setChangePasswordOpen,
    logout,
  } = useApp();

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadServerCount = notifications.filter((n) => !n.read).length;
  const totalBadgeCount = unreadServerCount + deadlineReminders.length;

  const activeProject =
    route.page === "project-detail"
      ? projects.find((p) => p.id === route.projectId)
      : null;

  const pageTitleMap = {
    dashboard: "Personal Dashboard",
    projects: "Projects Directory",
    tasks: "All Tasks & Issue Tracker",
    calendar: "Workspace Calendar",
    reports: "Analytics, Workload & Reports",
    audit: "Audit Trail & Activity History",
    admin: "Admin — User & Role Management",
  };

  const currentTitle = activeProject
    ? activeProject.name
    : pageTitleMap[route.page] || "Workspace";

  const handleGlobalSearchChange = (e) => {
    const val = e.target.value;
    setGlobalSearch(val);
    if (val.trim() && route.page !== "tasks" && route.page !== "project-detail") {
      navigate("tasks");
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-btn mobile-menu-btn"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <div className="topbar-breadcrumb">
          <h1 className="topbar-title">{currentTitle}</h1>
        </div>
      </div>

      <div className="topbar-center">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="search"
            className="search-input"
            placeholder="Search tasks, bugs, tags, or projects..."
            value={globalSearch}
            onChange={handleGlobalSearchChange}
          />
        </div>
      </div>

      <div className="topbar-right">
        {projects.length > 0 && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              setTaskModalState({
                open: true,
                defaultProjectId: activeProject?.id || projects[0]?.id,
                defaultSprintId: null,
                defaultType: "Task",
                editTask: null,
              })
            }
          >
            <Plus size={15} />
            <span className="hide-xs">New Task</span>
          </button>
        )}

        {canCreateProject && (
          <button
            type="button"
            className="btn btn-secondary btn-sm hide-sm"
            onClick={() => setProjectModalState({ open: true, editProject: null })}
          >
            <FolderPlus size={15} />
            <span>New Project</span>
          </button>
        )}

        {/* Notifications & Deadline Reminders Popover */}
        <div className="popover-wrapper" ref={notifRef}>
          <button
            type="button"
            className="icon-btn notif-trigger"
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Notifications"
            title="Notifications & Reminders"
          >
            <Bell size={19} />
            {totalBadgeCount > 0 && (
              <span className="notif-badge">{totalBadgeCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-popover">
              <div className="notif-header">
                <strong>Notifications & Alerts</strong>
                {unreadServerCount > 0 && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={markAllNotificationsRead}
                  >
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>

              <div className="notif-list">
                {deadlineReminders.map((rem) => (
                  <div
                    key={rem.id}
                    className={`notif-item notif-reminder notif-${rem.type}`}
                    onClick={() => {
                      setActiveTaskId(rem.taskId);
                      setNotifOpen(false);
                    }}
                  >
                    <div className="notif-icon">
                      {rem.type === "overdue" ? (
                        <AlertTriangle size={15} />
                      ) : (
                        <Clock size={15} />
                      )}
                    </div>
                    <div className="notif-body">
                      <div className="notif-text">{rem.text}</div>
                      <div className="notif-meta">Deadline Alert • Click to view task</div>
                    </div>
                  </div>
                ))}

                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${n.read ? "notif-read" : "notif-unread"}`}
                    onClick={() => {
                      if (!n.read) markNotificationRead(n.id);
                      if (n.taskId) {
                        setActiveTaskId(n.taskId);
                        setNotifOpen(false);
                      }
                    }}
                  >
                    <div className="notif-dot" />
                    <div className="notif-body">
                      <div className="notif-text">{n.text}</div>
                      <div className="notif-meta">
                        {n.type?.toUpperCase()} • {formatDateTime(n.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}

                {deadlineReminders.length === 0 && notifications.length === 0 && (
                  <div className="notif-empty">
                    You are all caught up! No notifications or overdue alerts.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dark / Light Theme Toggle */}
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
          aria-label="Toggle color theme"
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* User Avatar & Logout */}
        {currentUser && (
          <div className="topbar-user">
            <UserAvatar user={currentUser} size={32} showTooltip />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setChangePasswordOpen(true)}
              title="Change Password"
              aria-label="Change password"
            >
              <KeyRound size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={logout}
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
