import React from "react";
import {
  LayoutDashboard,
  Columns,
  ListTodo,
  Zap,
  GanttChart,
  Calendar,
  Users,
  Video,
  ShieldAlert,
  BarChart3,
  Edit3,
  CheckCircle2,
  Archive,
  RotateCcw,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { StatusBadge, EmptyState } from "../components/ui/Primitives";
import { ProjectOverviewTab } from "../components/project/ProjectOverviewTab";
import { KanbanBoardTab } from "../components/project/KanbanBoardTab";
import { SprintsTab } from "../components/project/SprintsTab";
import { methodologyOf } from "../constants/seedMeta";
import { GanttTab } from "../components/project/GanttTab";
import { TeamTab } from "../components/project/TeamTab";
import { MeetingsTab } from "../components/project/MeetingsTab";
import { RisksTab } from "../components/project/RisksTab";
import { GlobalTasksView } from "./GlobalTasksView";
import { GlobalCalendarView } from "./GlobalCalendarView";
import { ReportsAnalyticsView } from "./ReportsAnalyticsView";

export function ProjectDetailView() {
  const {
    route,
    navigate,
    projects,
    canManageProject,
    setProjectModalState,
    updateProjectStatus,
  } = useApp();

  const project = projects.find((p) => p.id === route.projectId);

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="The requested project does not exist or you do not have access to view it."
        actionLabel="Back to Projects"
        onAction={() => navigate("projects")}
      />
    );
  }

  const manageable = canManageProject(project);
  const activeTab = route.tab || "overview";

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "kanban", label: "Kanban Board", icon: Columns },
    { id: "list", label: "Tasks & Bugs", icon: ListTodo },
    { id: "sprints", label: `${methodologyOf(project).stages} & Backlog`, icon: Zap },
    { id: "gantt", label: "Gantt & Dependencies", icon: GanttChart },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "team", label: "Team & Workload", icon: Users },
    { id: "meetings", label: "Meetings", icon: Video },
    { id: "risks", label: "Risk Register", icon: ShieldAlert },
    { id: "analytics", label: "Analytics & Export", icon: BarChart3 },
  ];

  return (
    <div>
      {/* Project Header Banner */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "14px 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 19 }}>{project.name}</h2>
          <StatusBadge status={project.status} />
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Template: <strong>{project.template || "Custom"}</strong>
          </span>
        </div>

        {manageable && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setProjectModalState({ open: true, editProject: project })}
            >
              <Edit3 size={14} /> Edit Project
            </button>
            {project.status !== "Completed" && (
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => updateProjectStatus(project.id, "Completed")}
              >
                <CheckCircle2 size={14} /> Mark Completed
              </button>
            )}
            {project.status !== "Archived" ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => updateProjectStatus(project.id, "Archived")}
              >
                <Archive size={14} /> Archive
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => updateProjectStatus(project.id, "Active")}
              >
                <RotateCcw size={14} /> Reactivate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Project Workspace Tabs Bar */}
      <div className="tabs-bar">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
              onClick={() => navigate("project-detail", project.id, t.id)}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      {activeTab === "overview" && <ProjectOverviewTab project={project} />}
      {activeTab === "kanban" && <KanbanBoardTab project={project} />}
      {activeTab === "list" && <GlobalTasksView fixedProjectId={project.id} />}
      {activeTab === "sprints" && <SprintsTab project={project} />}
      {activeTab === "gantt" && <GanttTab project={project} />}
      {activeTab === "calendar" && <GlobalCalendarView fixedProjectId={project.id} />}
      {activeTab === "team" && <TeamTab project={project} />}
      {activeTab === "meetings" && <MeetingsTab project={project} />}
      {activeTab === "risks" && <RisksTab project={project} />}
      {activeTab === "analytics" && <ReportsAnalyticsView fixedProjectId={project.id} />}
    </div>
  );
}
