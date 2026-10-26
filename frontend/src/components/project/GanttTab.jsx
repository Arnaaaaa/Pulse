import React from "react";
import { Link2, Flag } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { daysBetween, todayISO, addDays, dayOf } from "../../constants/seedMeta";
import { StatusBadge, EmptyState } from "../ui/Primitives";

export function GanttTab({ project }) {
  const { tasks, setActiveTaskId } = useApp();

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const startWindow = project.startDate || addDays(todayISO(), -14);
  const endWindow = project.endDate || addDays(todayISO(), 30);
  const totalSpanDays = Math.max(7, daysBetween(startWindow, endWindow));

  const getOffsetAndWidth = (startStr, endStr) => {
    const s = startStr || todayISO();
    const e = endStr && endStr >= s ? endStr : addDays(s, 3);
    const startOffset = Math.max(0, daysBetween(startWindow, s));
    const duration = Math.max(2, daysBetween(s, e));
    const leftPct = Math.min(92, Math.max(0, (startOffset / totalSpanDays) * 100));
    const widthPct = Math.min(100 - leftPct, Math.max(6, (duration / totalSpanDays) * 100));
    return { leftPct, widthPct, duration };
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Gantt Schedule, Task Durations & Dependencies</h3>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Project Timeline Window: <strong>{startWindow}</strong> to <strong>{endWindow}</strong> ({totalSpanDays} days)
          </div>
        </div>
      </div>

      {/* Milestones Strip */}
      {(project.milestones || []).length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            padding: "10px 12px",
            marginBottom: 16,
            borderRadius: 8,
            backgroundColor: "var(--bg-subtle)",
          }}
        >
          {project.milestones.map((m) => (
            <div
              key={m.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 999,
                backgroundColor: "var(--purple-soft)",
                color: "var(--purple)",
                fontWeight: 600,
              }}
            >
              <Flag size={12} />
              <span>
                {m.name} ({m.date}) {m.done ? "✓" : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {projectTasks.length === 0 ? (
        <EmptyState
          title="No tasks scheduled in this project"
          description="Create tasks with due dates and dependencies to visualize them on the Gantt chart."
        />
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: 8 }}>
          <div className="gantt-row" style={{ backgroundColor: "var(--bg-subtle)", fontWeight: 700, fontSize: 12 }}>
            <div className="gantt-label-col">Task & Dependencies</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 16px", color: "var(--text-muted)" }}>
              <span>{startWindow}</span>
              <span>Today ({todayISO()})</span>
              <span>{endWindow}</span>
            </div>
          </div>

          {projectTasks.map((t) => {
            const { leftPct, widthPct } = getOffsetAndWidth(dayOf(t.createdAt), t.dueDate);
            const barColor =
              t.status === "Completed"
                ? "var(--success)"
                : t.status === "Under Review"
                ? "var(--warning)"
                : t.priority === "Critical"
                ? "var(--danger)"
                : "var(--brand)";

            const deps = (t.dependsOn || [])
              .map((id) => tasks.find((x) => x.id === id))
              .filter(Boolean);

            return (
              <div key={t.id} className="gantt-row">
                <div
                  className="gantt-label-col"
                  style={{ cursor: "pointer" }}
                  onClick={() => setActiveTaskId(t.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  {deps.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Link2 size={11} /> Depends on: {deps.map((d) => d.title).join(", ")}
                    </div>
                  )}
                </div>

                <div className="gantt-bar-track">
                  <div
                    className="gantt-bar"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: barColor,
                    }}
                    onClick={() => setActiveTaskId(t.id)}
                    title={`${t.title}: ${dayOf(t.createdAt) || startWindow} → ${t.dueDate || endWindow}`}
                  >
                    {t.title} ({t.dueDate || "No due date"})
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
