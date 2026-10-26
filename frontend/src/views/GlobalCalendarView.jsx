import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useApp } from "../context/AppContext";
import { todayISO } from "../constants/seedMeta";

export function GlobalCalendarView({ fixedProjectId = null }) {
  const {
    tasks,
    projects,
    setActiveTaskId,
    navigate,
  } = useApp();

  const [cursorDate, setCursorDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [showTasks, setShowTasks] = useState(true);
  const [showMilestones, setShowMilestones] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);

  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const monthLabel = cursorDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  const scopedProjects = fixedProjectId
    ? projects.filter((p) => p.id === fixedProjectId)
    : projects;
  const scopedTasks = fixedProjectId
    ? tasks.filter((t) => t.projectId === fixedProjectId)
    : tasks;

  const eventsByDate = useMemo(() => {
    const map = {};
    const addEvent = (dateStr, ev) => {
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(ev);
    };

    if (showTasks) {
      scopedTasks.forEach((t) => {
        if (t.dueDate) {
          addEvent(t.dueDate, {
            id: `task_${t.id}`,
            kind: "task",
            label: `Task: ${t.title}`,
            color:
              t.status === "Completed"
                ? "var(--success-soft)"
                : t.priority === "Critical"
                ? "var(--danger-soft)"
                : "var(--brand-soft)",
            textColor:
              t.status === "Completed"
                ? "var(--success)"
                : t.priority === "Critical"
                ? "var(--danger)"
                : "var(--brand)",
            onClick: () => setActiveTaskId(t.id),
          });
        }
      });
    }

    if (showMilestones) {
      scopedProjects.forEach((p) => {
        (p.milestones || []).forEach((m) => {
          addEvent(m.date, {
            id: `ms_${p.id}_${m.id}`,
            kind: "milestone",
            label: `Milestone: ${m.name}`,
            color: "var(--purple-soft)",
            textColor: "var(--purple)",
            onClick: () => navigate("project-detail", p.id, "overview"),
          });
        });
      });
    }

    if (showMeetings) {
      scopedProjects.forEach((p) => {
        (p.meetings || []).forEach((mt) => {
          addEvent(mt.date, {
            id: `mt_${p.id}_${mt.id}`,
            kind: "meeting",
            label: `Meeting: ${mt.title}${mt.time ? ` (${mt.time})` : ""}`,
            color: "var(--warning-soft)",
            textColor: "var(--warning)",
            onClick: () => navigate("project-detail", p.id, "meetings"),
          });
        });
      });
    }

    return map;
  }, [scopedTasks, scopedProjects, showTasks, showMilestones, showMeetings, setActiveTaskId, navigate]);

  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ empty: true, key: `empty_start_${i}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const iso = `${year}-${mm}-${dd}`;
      cells.push({
        empty: false,
        day: d,
        iso,
        events: eventsByDate[iso] || [],
        key: iso,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ empty: true, key: `empty_end_${cells.length}` });
    }

    return cells;
  }, [year, month, eventsByDate]);

  const today = todayISO();

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setCursorDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <h3 style={{ margin: 0, minWidth: 160, textAlign: "center", fontSize: 16 }}>
            {monthLabel}
          </h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setCursorDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const now = new Date();
              setCursorDate(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            <CalendarIcon size={14} /> Today
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showTasks}
              onChange={(e) => setShowTasks(e.target.checked)}
            />
            <span>Task Deadlines</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showMilestones}
              onChange={(e) => setShowMilestones(e.target.checked)}
            />
            <span>Milestones</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showMeetings}
              onChange={(e) => setShowMeetings(e.target.checked)}
            />
            <span>Meetings</span>
          </label>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div className="calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="calendar-day-header">
              {d}
            </div>
          ))}

          {calendarCells.map((cell) => {
            if (cell.empty) {
              return <div key={cell.key} className="calendar-cell calendar-cell-muted" />;
            }
            const isToday = cell.iso === today;
            return (
              <div
                key={cell.key}
                className="calendar-cell"
                style={
                  isToday
                    ? { backgroundColor: "var(--brand-soft)", borderColor: "var(--brand)" }
                    : undefined
                }
              >
                <div
                  className="calendar-date-num"
                  style={{
                    color: isToday ? "var(--brand)" : undefined,
                    fontWeight: isToday ? 800 : 600,
                  }}
                >
                  {cell.day} {isToday ? "• Today" : ""}
                </div>

                {cell.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="calendar-pill"
                    style={{
                      backgroundColor: ev.color,
                      color: ev.textColor,
                      fontWeight: 600,
                    }}
                    onClick={ev.onClick}
                    title={ev.label}
                  >
                    {ev.label}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
