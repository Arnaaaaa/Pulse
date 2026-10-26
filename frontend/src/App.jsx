import React, { useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { AppProvider, useApp } from "./context/AppContext";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { ToastContainer } from "./components/ui/Primitives";
import { LoginView } from "./views/LoginView";
import { PersonalDashboardView } from "./views/PersonalDashboardView";
import { ProjectsDirectoryView } from "./views/ProjectsDirectoryView";
import { ProjectDetailView } from "./views/ProjectDetailView";
import { GlobalTasksView } from "./views/GlobalTasksView";
import { GlobalCalendarView } from "./views/GlobalCalendarView";
import { ReportsAnalyticsView } from "./views/ReportsAnalyticsView";
import { AuditTrailView } from "./views/AuditTrailView";
import { AdminUsersView } from "./views/AdminUsersView";
import { ProjectModal } from "./components/modals/ProjectModal";
import { TaskModal } from "./components/modals/TaskModal";
import { TaskDetailDrawer } from "./components/modals/TaskDetailDrawer";
import { RatingModal } from "./components/modals/RatingModal";
import { ChangePasswordModal } from "./components/modals/ChangePasswordModal";

function WorkspaceRouter() {
  const {
    currentUser,
    isLoading,
    apiError,
    hydrateWorkspace,
    route,
    toasts,
    dismissToast,
  } = useApp();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (!currentUser) {
    return (
      <>
        <LoginView />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="main-area">
        <Topbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

        <main className="page-content">
          {apiError && (
            <div
              className="card"
              style={{
                marginBottom: 16,
                borderColor: "var(--danger)",
                backgroundColor: "var(--danger-soft)",
                color: "var(--danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={18} />
                <span>{apiError}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => hydrateWorkspace().catch(() => {})}
              >
                <RefreshCw size={14} /> Retry Connection
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="card" style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                Loading PULSE — Project Updates, Logistics &amp; Scheduling Engine...
              </div>
            </div>
          ) : (
            <>
              {route.page === "dashboard" && <PersonalDashboardView />}
              {route.page === "projects" && <ProjectsDirectoryView />}
              {route.page === "project-detail" && <ProjectDetailView />}
              {route.page === "tasks" && <GlobalTasksView />}
              {route.page === "calendar" && <GlobalCalendarView />}
              {route.page === "reports" && <ReportsAnalyticsView />}
              {route.page === "audit" && <AuditTrailView />}
              {route.page === "admin" && <AdminUsersView />}
            </>
          )}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <ProjectModal />
      <TaskModal />
      <TaskDetailDrawer />
      <RatingModal />
      <ChangePasswordModal />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <WorkspaceRouter />
    </AppProvider>
  );
}
