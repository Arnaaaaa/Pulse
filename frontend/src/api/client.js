const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

// Called when a signed-in request comes back 401 (expired, logged out elsewhere, deactivated, ...)
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, { sessionCheck = true, ...options } = {}) {
  // FormData bodies (file uploads) set their own multipart Content-Type
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const err = new Error(errBody.error || `Request failed with status ${response.status}`);
    err.status = response.status;
    if (response.status === 401 && sessionCheck && authToken && onUnauthorized) onUnauthorized();
    throw err;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

const post = (path, body, opts) => request(path, { method: "POST", body: JSON.stringify(body || {}), ...opts });
const patch = (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body || {}) });
const del = (path) => request(path, { method: "DELETE" });

export const api = {
  // Health
  health: () => request("/health"),

  // Auth — every flow is: request a code by email, verify it, then (for passwords) set the new one
  newUserRequestCode: (name, email) => post("/auth/new-user/request-code", { name, email }),
  newUserVerifyCode: (name, email, code) => post("/auth/new-user/verify-code", { name, email, code }),
  newUserSetPassword: (tempToken, password) => post("/auth/new-user/set-password", { tempToken, password }),

  loginRequestCode: (name, email, password) => post("/auth/login/request-code", { name, email, password }),
  loginVerifyCode: (name, email, code) => post("/auth/login/verify-code", { name, email, code }),

  forgotRequestCode: (name, email) => post("/auth/forgot-password/request-code", { name, email }),
  forgotVerifyCode: (name, email, code) => post("/auth/forgot-password/verify-code", { name, email, code }),
  forgotReset: (tempToken, newPassword) => post("/auth/forgot-password/reset", { tempToken, newPassword }),

  // Signed in: the session token identifies the user. A 401 here means a bad reset token, not an ended session.
  changeRequestCode: () => post("/auth/change-password/request-code"),
  changeVerifyCode: (code) => post("/auth/change-password/verify-code", { code }),
  changeReset: (tempToken, newPassword) =>
    post("/auth/change-password/reset", { tempToken, newPassword }, { sessionCheck: false }),

  me: () => request("/auth/me"),
  logout: () => post("/auth/logout"),

  // Users
  getUsers: () => request("/users"),
  getUser: (id) => request(`/users/${id}`),
  createEmployee: (payload) => post("/users", payload),
  updateUser: (id, changes) => patch(`/users/${id}`, changes),
  addUserRating: (id, payload) => post(`/users/${id}/ratings`, payload),

  // Projects
  getProjects: () => request("/projects"),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (payload) => post("/projects", payload),
  updateProject: (id, changes) => patch(`/projects/${id}`, changes),
  updateProjectStatus: (id, status) => patch(`/projects/${id}/status`, { status }),
  postAnnouncement: (projectId, text) => post(`/projects/${projectId}/announcements`, { text }),
  addProjectMember: (projectId, userId) => post(`/projects/${projectId}/members`, { userId }),
  removeProjectMember: (projectId, userId) => del(`/projects/${projectId}/members/${userId}`),
  createSprint: (projectId, payload) => post(`/projects/${projectId}/sprints`, payload),
  updateSprint: (projectId, sprintId, changes) => patch(`/projects/${projectId}/sprints/${sprintId}`, changes),
  createRisk: (projectId, payload) => post(`/projects/${projectId}/risks`, payload),
  deleteRisk: (projectId, riskId) => del(`/projects/${projectId}/risks/${riskId}`),
  createMeeting: (projectId, payload) => post(`/projects/${projectId}/meetings`, payload),
  updateMeeting: (projectId, meetingId, changes) => patch(`/projects/${projectId}/meetings/${meetingId}`, changes),

  // Tasks
  getTasks: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") search.set(k, v);
    });
    const qs = search.toString();
    return request(`/tasks${qs ? `?${qs}` : ""}`);
  },
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (payload) => post("/tasks", payload),
  updateTask: (id, changes) => patch(`/tasks/${id}`, changes),
  changeTaskStatus: (id, status) => patch(`/tasks/${id}/status`, { status }),
  deleteTask: (id) => del(`/tasks/${id}`),
  addSubtask: (taskId, text) => post(`/tasks/${taskId}/subtasks`, { text }),
  toggleSubtask: (taskId, subId, done) =>
    patch(`/tasks/${taskId}/subtasks/${subId}`, done !== undefined ? { done } : {}),
  addComment: (taskId, text) => post(`/tasks/${taskId}/comments`, { text }),
  uploadAttachment: (taskId, file) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/tasks/${taskId}/attachments`, { method: "POST", body: form });
  },
  addLinkAttachment: (taskId, url, name) => post(`/tasks/${taskId}/attachments`, { url, name }),
  getAttachmentUrl: (taskId, attId) => request(`/tasks/${taskId}/attachments/${attId}/download`),
  deleteAttachment: (taskId, attId) => del(`/tasks/${taskId}/attachments/${attId}`),
  logTaskTime: (taskId, hours) => post(`/tasks/${taskId}/time-log`, { hours }),

  // Notifications
  getNotifications: () => request("/notifications"),
  markNotificationRead: (id) => patch(`/notifications/${id}/read`),
  markAllNotificationsRead: () => patch("/notifications/read-all"),

  // Activity
  getActivity: (projectId) =>
    request(`/activity?limit=500${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`),
};
