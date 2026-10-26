import React, { useState } from "react";
import {
  Plus,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Clock,
  Link2,
  Repeat,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { STATUSES, PRIORITIES, isTaskOverdue, methodologyOf } from "../../constants/seedMeta";
import {
  PriorityBadge,
  SeverityBadge,
  TagChip,
  UserAvatar,
} from "../ui/Primitives";

export function KanbanBoardTab({ project }) {
  const {
    tasks,
    users,
    currentUser,
    canManageProject,
    canMoveTask,
    changeTaskStatus,
    setActiveTaskId,
    setTaskModalState,
  } = useApp();

  const [sprintFilter, setSprintFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);

  const manageable = canManageProject(project);

  const projectTasks = tasks.filter((t) => {
    if (t.projectId !== project.id) return false;
    if (sprintFilter === "Backlog" && t.sprintId) return false;
    if (sprintFilter !== "All" && sprintFilter !== "Backlog" && t.sprintId !== sprintFilter)
      return false;
    if (assigneeFilter !== "All" && t.assigneeId !== assigneeFilter) return false;
    if (priorityFilter !== "All" && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    if (dragOverStatus !== status) setDragOverStatus(status);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== targetStatus && canMoveTask(task)) {
      await changeTaskStatus(task, targetStatus);
    }
  };

  return (
    <div>
      {/* Kanban Filter Bar */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          padding: "12px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            className="form-select"
            style={{ width: 200 }}
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value)}
          >
            <option value="All">All {methodologyOf(project).stages} & Backlog</option>
            <option value="Backlog">{methodologyOf(project).backlog} Only</option>
            {(project.sprints || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            style={{ width: 170 }}
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="All">All Members</option>
            {users
              .filter((u) => (project.memberIds || []).includes(u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>

          <select
            className="form-select"
            style={{ width: 150 }}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() =>
            setTaskModalState({
              open: true,
              defaultProjectId: project.id,
              defaultSprintId:
                sprintFilter !== "All" && sprintFilter !== "Backlog" ? sprintFilter : null,
              defaultType: "Task",
              editTask: null,
            })
          }
        >
          <Plus size={15} /> Add Task
        </button>
      </div>

      {/* 4-Column Drag & Drop Kanban Grid (Requirement #9) */}
      <div className="kanban-grid">
        {STATUSES.map((status) => {
          const colTasks = projectTasks.filter((t) => t.status === status);
          return (
            <div
              key={status}
              className={`kanban-column ${dragOverStatus === status ? "drag-over" : ""}`}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="kanban-col-header">
                <div className="kanban-col-title">
                  <span>{status}</span>
                  <span className="kanban-count">{colTasks.length}</span>
                </div>
              </div>

              <div className="kanban-cards">
                {colTasks.map((task) => {
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  const subtasks = task.subtasks || [];
                  const doneSubs = subtasks.filter((s) => s.done).length;
                  const overdue = isTaskOverdue(task);
                  const blocked = (task.dependsOn || []).some((depId) => {
                    const dep = tasks.find((x) => x.id === depId);
                    return dep && dep.status !== "Completed";
                  });

                  return (
                    <div
                      key={task.id}
                      className="kanban-card"
                      draggable={canMoveTask(task)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => setActiveTaskId(task.id)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <PriorityBadge priority={task.priority} />
                          {task.type && task.type !== "Task" && (
                            <span className="badge badge-status-todo">{task.type}</span>
                          )}
                          {task.severity && <SeverityBadge severity={task.severity} />}
                        </div>
                        {blocked && (
                          <span
                            className="badge badge-priority-critical"
                            title="Has unfinished prerequisite dependency"
                          >
                            <Link2 size={11} /> Blocked
                          </span>
                        )}
                      </div>

                      <div className="kanban-card-title">{task.title}</div>

                      {(task.tags || []).length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                          {task.tags.map((tg) => (
                            <TagChip key={tg} tag={tg} />
                          ))}
                        </div>
                      )}

                      {/* Manager quick-approve button for Under Review items */}
                      {manageable && task.status === "Under Review" && (
                        <div
                          style={{ marginTop: 8 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            style={{ width: "100%" }}
                            onClick={() => changeTaskStatus(task, "Completed")}
                          >
                            <CheckCircle2 size={13} /> Approve & Complete
                          </button>
                        </div>
                      )}

                      <div className="kanban-card-footer">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {subtasks.length > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <CheckSquare size={12} /> {doneSubs}/{subtasks.length}
                            </span>
                          )}
                          {(task.comments || []).length > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <MessageSquare size={12} /> {task.comments.length}
                            </span>
                          )}
                          {(task.attachments || []).length > 0 && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <Paperclip size={12} /> {task.attachments.length}
                            </span>
                          )}
                          {task.recurring?.enabled && (
                            <span title={`Recurring ${task.recurring.freq}`}>
                              <Repeat size={12} />
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {task.dueDate && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                color: overdue ? "var(--danger)" : undefined,
                                fontWeight: overdue ? 700 : 500,
                              }}
                            >
                              <Clock size={11} /> {task.dueDate.slice(5)}
                            </span>
                          )}
                          <UserAvatar user={assignee} size={22} showTooltip />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
