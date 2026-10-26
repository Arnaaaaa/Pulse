import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { api, setAuthToken, setUnauthorizedHandler } from "../api/client";
import { isTaskOverdue, isTaskApproaching } from "../constants/seedMeta";

const AppContext = createContext(null);

const AUTH_STORAGE_KEY = "pulse_auth_session";
const THEME_STORAGE_KEY = "pulse_theme";

function parseHashRoute(hash) {
  const clean = (hash || "#/dashboard").replace(/^#/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts[0] === "projects" && parts[1]) {
    return { page: "project-detail", projectId: parts[1], tab: parts[2] || "overview" };
  }
  return { page: parts[0] || "dashboard", projectId: null, tab: "overview" };
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode); the app still works for this tab
  }
}

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() => readStorage(THEME_STORAGE_KEY) || "light");
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Routing state synced with location.hash
  const [route, setRoute] = useState(() => parseHashRoute(window.location.hash));
  const [globalSearch, setGlobalSearch] = useState("");

  // Global Modals & Drawers
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskModalState, setTaskModalState] = useState({ open: false, defaultProjectId: null, defaultSprintId: null, defaultType: "Task", editTask: null });
  const [projectModalState, setProjectModalState] = useState({ open: false, editProject: null });
  const [ratingModalProject, setRatingModalProject] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Deactivated accounts only matter on the Admin page; everywhere else uses active people
  const users = useMemo(() => allUsers.filter((u) => u.active !== false), [allUsers]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    writeStorage(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const showToast = useCallback((message, type = "info") => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Every action reports failures as a toast and resolves to null, so callers never see a rejected promise
  const fail = useCallback(
    (err, fallback) => {
      showToast(err?.message || fallback, "error");
      return null;
    },
    [showToast]
  );

  // Sync URL hash
  useEffect(() => {
    const onHashChange = () => setRoute(parseHashRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((page, projectId = null, tab = "overview") => {
    if (page === "project-detail" && projectId) {
      window.location.hash = `#/projects/${projectId}/${tab}`;
    } else {
      window.location.hash = `#/${page}`;
    }
  }, []);

  const clearSession = useCallback(() => {
    writeStorage(AUTH_STORAGE_KEY, null);
    setAuthToken(null);
    setCurrentUser(null);
    setAllUsers([]);
    setProjects([]);
    setTasks([]);
    setNotifications([]);
    setActivity([]);
    setActiveTaskId(null);
    setIsLoading(false);
  }, []);

  // Any 401 on a signed-in request (expired token, logged out elsewhere, deactivated) ends the session
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      showToast("Your session has ended. Please sign in again.", "info");
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, showToast]);

  // Employees can be added or finish onboarding while someone is signed in
  const refreshUsers = useCallback(async () => {
    try {
      setAllUsers(await api.getUsers());
    } catch {
      // keep the current list
    }
  }, []);

  // Sync side-effect feeds (notifications + activity)
  const refreshFeeds = useCallback(async () => {
    try {
      const [freshNotifs, freshActivity] = await Promise.all([
        api.getNotifications(),
        api.getActivity(),
      ]);
      setNotifications(freshNotifs);
      setActivity(freshActivity);
    } catch {
      // silent background refresh
    }
  }, []);

  // Full workspace data hydration
  const hydrateWorkspace = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const [me, freshUsers, freshProjects, freshTasks, freshNotifs, freshActivity] = await Promise.all([
        api.me(),
        api.getUsers(),
        api.getProjects(),
        api.getTasks(),
        api.getNotifications(),
        api.getActivity(),
      ]);
      setCurrentUser(me);
      setAllUsers(freshUsers);
      setProjects(freshProjects);
      setTasks(freshTasks);
      setNotifications(freshNotifs);
      setActivity(freshActivity);
      return me;
    } catch (err) {
      if (err.status !== 401) setApiError(err.message || "Could not connect to PULSE backend API");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restore session on initial mount
  useEffect(() => {
    try {
      const session = JSON.parse(readStorage(AUTH_STORAGE_KEY) || "null");
      if (session?.token && session?.user) {
        setAuthToken(session.token);
        setCurrentUser(session.user);
        hydrateWorkspace();
        return;
      }
    } catch {
      // corrupt session entry; fall through to the login screen
    }
    setIsLoading(false);
  }, [hydrateWorkspace]);

  // Auth: LoginView runs the code/password steps against the API, then hands the session over here
  // Also used after a password change, which revokes the old token and returns a new one
  const completeSignIn = useCallback(
    async ({ user, token }, { quiet = false } = {}) => {
      setAuthToken(token);
      setCurrentUser(user);
      writeStorage(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
      if (quiet) return;
      await hydrateWorkspace();
      showToast(`Signed in as ${user.name} (${user.role})`, "success");
    },
    [hydrateWorkspace, showToast]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // the token may already be invalid; signing out locally is what matters
    }
    clearSession();
    // The next person to sign in on this browser starts on their own dashboard
    window.location.hash = "#/dashboard";
    showToast("Signed out successfully", "info");
  }, [clearSession, showToast]);

  // Permission helpers matching backend rules
  const canCreateProject = useMemo(
    () => Boolean(currentUser && currentUser.role === "Project Manager"),
    [currentUser]
  );

  const canManageProject = useCallback(
    (project) => {
      if (!currentUser || !project) return false;
      return currentUser.role === "Project Manager" && (project.memberIds || []).includes(currentUser.id);
    },
    [currentUser]
  );

  const projectOf = useCallback((task) => projects.find((p) => p.id === task?.projectId), [projects]);

  // Moving on the board and logging time: the assignee or a manager
  const canMoveTask = useCallback(
    (task) => Boolean(currentUser && task && (task.assigneeId === currentUser.id || canManageProject(projectOf(task)))),
    [currentUser, canManageProject, projectOf]
  );

  // Editing fields and subtasks: a manager, the assignee or the reporter
  const canEditTask = useCallback(
    (task) =>
      Boolean(
        currentUser &&
          task &&
          (canManageProject(projectOf(task)) || task.assigneeId === currentUser.id || task.reporterId === currentUser.id)
      ),
    [currentUser, canManageProject, projectOf]
  );

  // Deleting: a manager or the reporter
  const canDeleteTask = useCallback(
    (task) => Boolean(currentUser && task && (canManageProject(projectOf(task)) || task.reporterId === currentUser.id)),
    [currentUser, canManageProject, projectOf]
  );

  const replaceProject = (updated) => setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  const patchProject = (projectId, fn) => setProjects((prev) => prev.map((p) => (p.id === projectId ? fn(p) : p)));

  // Project Actions
  const createProject = useCallback(
    async (payload) => {
      try {
        const created = await api.createProject(payload);
        setProjects((prev) => [created, ...prev]);
        refreshFeeds();
        showToast(`Project "${created.name}" created`, "success");
        return created;
      } catch (err) {
        return fail(err, "Could not create project");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const updateProject = useCallback(
    async (id, changes, { quiet = false } = {}) => {
      try {
        const updated = await api.updateProject(id, changes);
        replaceProject(updated);
        refreshFeeds();
        if (!quiet) showToast("Project updated", "success");
        return updated;
      } catch (err) {
        return fail(err, "Could not update project");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const updateProjectStatus = useCallback(
    async (id, status) => {
      try {
        const updated = await api.updateProjectStatus(id, status);
        replaceProject(updated);
        refreshFeeds();
        showToast(`Project marked ${status}`, "success");
        if (status === "Completed") setRatingModalProject(updated);
        return updated;
      } catch (err) {
        return fail(err, "Could not change project status");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const postAnnouncement = useCallback(
    async (projectId, text) => {
      try {
        const ann = await api.postAnnouncement(projectId, text);
        patchProject(projectId, (p) => ({ ...p, announcements: [ann, ...(p.announcements || [])] }));
        refreshFeeds();
        showToast("Announcement published", "success");
        return ann;
      } catch (err) {
        return fail(err, "Could not publish announcement");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const addProjectMember = useCallback(
    async (projectId, userId, { quiet = false } = {}) => {
      try {
        const updated = await api.addProjectMember(projectId, userId);
        replaceProject(updated);
        refreshFeeds();
        if (!quiet) showToast("Team member added to project", "success");
        return updated;
      } catch (err) {
        return fail(err, "Could not add team member");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const removeProjectMember = useCallback(
    async (projectId, userId, { quiet = false } = {}) => {
      try {
        const updated = await api.removeProjectMember(projectId, userId);
        replaceProject(updated);
        // The server unassigns their open tasks in this project
        setTasks((prev) =>
          prev.map((t) =>
            t.projectId === projectId && t.assigneeId === userId && t.status !== "Completed" ? { ...t, assigneeId: null } : t
          )
        );
        refreshFeeds();
        if (!quiet) showToast("Team member removed from project", "info");
        return updated;
      } catch (err) {
        return fail(err, "Could not remove team member");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const createSprint = useCallback(
    async (projectId, payload) => {
      try {
        const sprint = await api.createSprint(projectId, payload);
        patchProject(projectId, (p) => ({ ...p, sprints: [...(p.sprints || []), sprint] }));
        refreshFeeds();
        showToast(`"${sprint.name}" created`, "success");
        return sprint;
      } catch (err) {
        return fail(err, "Could not create sprint");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const updateSprint = useCallback(
    async (projectId, sprintId, changes) => {
      try {
        const sprint = await api.updateSprint(projectId, sprintId, changes);
        // Sequential methodologies can change other stages too, and completing one may move unfinished tasks
        const [freshProject, freshTasks] = await Promise.all([api.getProject(projectId), api.getTasks()]);
        replaceProject(freshProject);
        setTasks(freshTasks);
        refreshFeeds();
        return sprint;
      } catch (err) {
        return fail(err, "Could not update sprint");
      }
    },
    [refreshFeeds, fail]
  );

  const createRisk = useCallback(
    async (projectId, payload) => {
      try {
        const risk = await api.createRisk(projectId, payload);
        patchProject(projectId, (p) => ({ ...p, risks: [...(p.risks || []), risk] }));
        refreshFeeds();
        showToast("Risk logged", "success");
        return risk;
      } catch (err) {
        return fail(err, "Could not log risk");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const deleteRisk = useCallback(
    async (projectId, riskId) => {
      try {
        await api.deleteRisk(projectId, riskId);
        patchProject(projectId, (p) => ({ ...p, risks: (p.risks || []).filter((r) => r.id !== riskId) }));
        refreshFeeds();
        showToast("Risk removed", "info");
        return true;
      } catch (err) {
        return fail(err, "Could not remove risk");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const createMeeting = useCallback(
    async (projectId, payload) => {
      try {
        const meeting = await api.createMeeting(projectId, payload);
        patchProject(projectId, (p) => ({ ...p, meetings: [meeting, ...(p.meetings || [])] }));
        refreshFeeds();
        showToast(`Meeting "${meeting.title}" scheduled`, "success");
        return meeting;
      } catch (err) {
        return fail(err, "Could not schedule meeting");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const updateMeeting = useCallback(
    async (projectId, meetingId, changes) => {
      try {
        const meeting = await api.updateMeeting(projectId, meetingId, changes);
        patchProject(projectId, (p) => ({ ...p, meetings: (p.meetings || []).map((m) => (m.id === meetingId ? meeting : m)) }));
        return meeting;
      } catch (err) {
        return fail(err, "Could not update meeting");
      }
    },
    [fail]
  );

  // Task Actions
  const replaceTask = (updated) => setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  const createTask = useCallback(
    async (payload) => {
      try {
        const created = await api.createTask(payload);
        setTasks((prev) => [created, ...prev]);
        refreshFeeds();
        showToast(`Task "${created.title}" created`, "success");
        return created;
      } catch (err) {
        return fail(err, "Could not create task");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const updateTask = useCallback(
    async (id, changes) => {
      try {
        const updated = await api.updateTask(id, changes);
        replaceTask(updated);
        refreshFeeds();
        return updated;
      } catch (err) {
        return fail(err, "Could not update task");
      }
    },
    [refreshFeeds, fail]
  );

  const changeTaskStatus = useCallback(
    async (taskOrId, newStatus) => {
      const task = typeof taskOrId === "string" ? tasks.find((t) => t.id === taskOrId) : taskOrId;
      if (!task) return null;

      // Quick client-side check; the server enforces the same rule
      if (newStatus !== "To Do" && Array.isArray(task.dependsOn) && task.dependsOn.length > 0) {
        const unfinishedDeps = task.dependsOn
          .map((depId) => tasks.find((t) => t.id === depId))
          .filter((dep) => dep && dep.status !== "Completed");
        if (unfinishedDeps.length > 0) {
          const names = unfinishedDeps.map((d) => `"${d.title}"`).join(", ");
          showToast(`Blocked by unfinished dependency: ${names}`, "error");
          return null;
        }
      }

      try {
        const { nextOccurrence, ...updated } = await api.changeTaskStatus(task.id, newStatus);
        replaceTask(updated);
        refreshFeeds();
        showToast(`Moved "${updated.title}" to ${newStatus}`, "success");

        // Recurring tasks: the server creates the next occurrence when one is completed
        if (nextOccurrence) {
          setTasks((prev) => [nextOccurrence, ...prev]);
          showToast(`Recurring (${task.recurring.freq}): next occurrence due ${nextOccurrence.dueDate}`, "info");
        }
        return updated;
      } catch (err) {
        return fail(err, "Could not update task status");
      }
    },
    [tasks, refreshFeeds, showToast, fail]
  );

  const deleteTask = useCallback(
    async (id) => {
      try {
        await api.deleteTask(id);
        // The server also removes the task from other tasks' dependencies
        setTasks((prev) =>
          prev
            .filter((t) => t.id !== id)
            .map((t) => ((t.dependsOn || []).includes(id) ? { ...t, dependsOn: t.dependsOn.filter((d) => d !== id) } : t))
        );
        setActiveTaskId((cur) => (cur === id ? null : cur));
        refreshFeeds();
        showToast("Task deleted", "info");
        return true;
      } catch (err) {
        return fail(err, "Could not delete task");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const addSubtask = useCallback(
    async (taskId, text) => {
      try {
        const sub = await api.addSubtask(taskId, text);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), sub] } : t)));
        return sub;
      } catch (err) {
        return fail(err, "Could not add checklist item");
      }
    },
    [fail]
  );

  const toggleSubtask = useCallback(
    async (taskId, subId, done) => {
      try {
        const sub = await api.toggleSubtask(taskId, subId, done);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, subtasks: (t.subtasks || []).map((s) => (s.id === subId ? sub : s)) } : t
          )
        );
        return sub;
      } catch (err) {
        return fail(err, "Could not update checklist item");
      }
    },
    [fail]
  );

  const addComment = useCallback(
    async (taskId, text) => {
      try {
        const comment = await api.addComment(taskId, text);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, comments: [...(t.comments || []), comment] } : t)));
        refreshFeeds();
        return comment;
      } catch (err) {
        return fail(err, "Could not post comment");
      }
    },
    [refreshFeeds, fail]
  );

  // Uploads a File (stored in Cloudinary) or saves a link: addAttachment(taskId, { file }) / ({ url, name })
  const addAttachment = useCallback(
    async (taskId, { file, url, name }) => {
      try {
        const att = file ? await api.uploadAttachment(taskId, file) : await api.addLinkAttachment(taskId, url, name);
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, attachments: [...(t.attachments || []), att] } : t)));
        refreshFeeds();
        showToast(`Attached "${att.name}"`, "success");
        return att;
      } catch (err) {
        return fail(err, "Could not add attachment");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const openAttachment = useCallback(
    async (taskId, attId) => {
      // Open the tab synchronously (popup blockers), then point it at the short-lived link
      const win = window.open("", "_blank");
      try {
        const { url } = await api.getAttachmentUrl(taskId, attId);
        if (win) win.location.href = url;
        else window.location.href = url;
      } catch (err) {
        if (win) win.close();
        fail(err, "Could not open attachment");
      }
    },
    [fail]
  );

  const deleteAttachment = useCallback(
    async (taskId, attId) => {
      try {
        await api.deleteAttachment(taskId, attId);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, attachments: (t.attachments || []).filter((a) => a.id !== attId) } : t))
        );
        refreshFeeds();
        showToast("Attachment removed", "info");
        return true;
      } catch (err) {
        return fail(err, "Could not remove attachment");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  const logTaskTime = useCallback(
    async (taskId, hours) => {
      try {
        const updated = await api.logTaskTime(taskId, hours);
        replaceTask(updated);
        refreshFeeds();
        showToast(`Logged ${hours}h`, "success");
        return updated;
      } catch (err) {
        return fail(err, "Could not log time");
      }
    },
    [refreshFeeds, showToast, fail]
  );

  // User & Admin Actions
  const applyUser = useCallback(
    (updated) => {
      setAllUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      if (currentUser?.id === updated.id) {
        setCurrentUser(updated);
        try {
          const session = JSON.parse(readStorage(AUTH_STORAGE_KEY) || "null");
          if (session) writeStorage(AUTH_STORAGE_KEY, JSON.stringify({ ...session, user: updated }));
        } catch {
          // ignore
        }
      }
    },
    [currentUser]
  );

  const createEmployee = useCallback(
    async (payload) => {
      try {
        const { user } = await api.createEmployee(payload);
        setAllUsers((prev) => [...prev, user].sort((a, b) => a.name.localeCompare(b.name)));
        showToast(`${user.name} added. They can now sign in with "First time here?"`, "success");
        return user;
      } catch (err) {
        return fail(err, "Could not add employee");
      }
    },
    [showToast, fail]
  );

  const updateUser = useCallback(
    async (userId, changes) => {
      try {
        const updated = await api.updateUser(userId, changes);
        applyUser(updated);
        showToast(`Updated ${updated.name}`, "success");
        return updated;
      } catch (err) {
        return fail(err, "Could not update user");
      }
    },
    [applyUser, showToast, fail]
  );

  const addUserRating = useCallback(
    async (userId, payload) => {
      try {
        const updated = await api.addUserRating(userId, payload);
        applyUser(updated);
        return updated;
      } catch (err) {
        return fail(err, "Could not save rating");
      }
    },
    [applyUser, fail]
  );

  // Notification Actions + Computed Deadline Reminders (Requirement #18)
  const markNotificationRead = useCallback(
    async (id) => {
      try {
        const updated = await api.markNotificationRead(id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
      } catch (err) {
        fail(err, "Could not update notification");
      }
    },
    [fail]
  );

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      showToast("All notifications marked as read", "info");
    } catch (err) {
      fail(err, "Could not update notifications");
    }
  }, [showToast, fail]);

  const deadlineReminders = useMemo(() => {
    if (!currentUser) return [];
    const myTasks = tasks.filter((t) => t.assigneeId === currentUser.id && t.status !== "Completed");
    const alerts = [];
    myTasks.forEach((t) => {
      if (isTaskOverdue(t)) {
        alerts.push({
          id: `rem_overdue_${t.id}`,
          taskId: t.id,
          type: "overdue",
          text: `Overdue: "${t.title}" was due on ${t.dueDate}`,
          date: t.dueDate,
        });
      } else if (isTaskApproaching(t, 2)) {
        alerts.push({
          id: `rem_soon_${t.id}`,
          taskId: t.id,
          type: "reminder",
          text: `Due soon: "${t.title}" is due on ${t.dueDate}`,
          date: t.dueDate,
        });
      }
    });
    return alerts;
  }, [currentUser, tasks]);

  const value = {
    theme,
    toggleTheme,
    currentUser,
    users,
    allUsers,
    projects,
    tasks,
    notifications,
    deadlineReminders,
    activity,
    isLoading,
    apiError,
    toasts,
    showToast,
    dismissToast,
    route,
    navigate,
    globalSearch,
    setGlobalSearch,
    // Modals & Drawers
    activeTaskId,
    setActiveTaskId,
    taskModalState,
    setTaskModalState,
    projectModalState,
    setProjectModalState,
    ratingModalProject,
    setRatingModalProject,
    changePasswordOpen,
    setChangePasswordOpen,
    // Permissions
    canCreateProject,
    canManageProject,
    canMoveTask,
    canEditTask,
    canDeleteTask,
    // Actions
    hydrateWorkspace,
    completeSignIn,
    logout,
    createProject,
    updateProject,
    updateProjectStatus,
    postAnnouncement,
    addProjectMember,
    removeProjectMember,
    createSprint,
    updateSprint,
    refreshUsers,
    createRisk,
    deleteRisk,
    createMeeting,
    updateMeeting,
    createTask,
    updateTask,
    changeTaskStatus,
    deleteTask,
    addSubtask,
    toggleSubtask,
    addComment,
    addAttachment,
    openAttachment,
    deleteAttachment,
    logTaskTime,
    createEmployee,
    updateUser,
    addUserRating,
    markNotificationRead,
    markAllNotificationsRead,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within an AppProvider");
  return ctx;
}
