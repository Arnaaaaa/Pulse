// End-to-end API tests against an in-memory MongoDB. Run: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test-secret";
process.env.OTP_RESEND_COOLDOWN_SECONDS = "0";
process.env.AUTH_RATE_LIMIT_PER_15_MIN = "10000";

// Capture codes instead of emailing them (must be patched before the routes load)
const codes = {};
const mailer = require("../src/utils/mailer");
mailer.sendOTPEmail = async (email, name, code, purpose) => { codes[`${email}:${purpose}`] = code; };

const connectDatabase = require("../config/database");
const app = require("../src/app");
const { User } = require("../src/models");

let mongo, server, base;

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// Runs the whole New User flow and returns a session token
async function onboard(name, email, password = "password123") {
  assert.equal((await api("POST", "/auth/new-user/request-code", { body: { name, email } })).status, 200);
  const v = await api("POST", "/auth/new-user/verify-code", { body: { name, email, code: codes[`${email}:new_user`] } });
  assert.equal(v.status, 200);
  const s = await api("POST", "/auth/new-user/set-password", { body: { tempToken: v.body.tempToken, password } });
  assert.equal(s.status, 200);
  return s.body.token;
}

const t = {}; // tokens
const u = {}; // user ids

before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  await mongoose.connection.syncIndexes();
  await User.create({ name: "Priya Sharma", email: "priya@pulse.io", role: "Admin" });
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
  await mongo?.stop();
});

test("new user flow: unknown people get the no-access message", async () => {
  const r = await api("POST", "/auth/new-user/request-code", { body: { name: "Wrong Name", email: "priya@pulse.io" } });
  assert.equal(r.status, 401);
  assert.match(r.body.error, /Sorry you dont have access/);
});

test("new user flow: code is never returned, wrong code rejected, short password does not burn the token", async () => {
  const body = { name: " priya sharma ", email: "PRIYA@pulse.io" };
  const req = await api("POST", "/auth/new-user/request-code", { body });
  assert.equal(req.status, 200);
  assert.equal(req.body.devCode, undefined);

  assert.equal((await api("POST", "/auth/new-user/verify-code", { body: { ...body, code: "000000x" } })).status, 400);
  const v = await api("POST", "/auth/new-user/verify-code", { body: { ...body, code: codes["priya@pulse.io:new_user"] } });
  assert.equal(v.status, 200);

  assert.equal((await api("POST", "/auth/new-user/set-password", { body: { tempToken: v.body.tempToken, password: "short" } })).status, 400);
  const s = await api("POST", "/auth/new-user/set-password", { body: { tempToken: v.body.tempToken, password: "password123" } });
  assert.equal(s.status, 200);
  assert.equal(s.body.user.passwordHash, undefined);
  assert.equal(s.body.user.isPasswordSet, true);
  // The reset token is single-use
  assert.equal((await api("POST", "/auth/new-user/set-password", { body: { tempToken: v.body.tempToken, password: "password456" } })).status, 401);
});

test("existing user login: password then code", async () => {
  const creds = { name: "Priya Sharma", email: "priya@pulse.io" };
  assert.equal((await api("POST", "/auth/login/request-code", { body: { ...creds, password: "wrong-pass" } })).status, 401);
  assert.equal((await api("POST", "/auth/login/request-code", { body: { ...creds, password: "password123" } })).status, 200);
  const v = await api("POST", "/auth/login/verify-code", { body: { ...creds, code: codes["priya@pulse.io:login"] } });
  assert.equal(v.status, 200);
  t.admin = v.body.token;
  u.admin = v.body.user.id;
  // A code works once
  assert.equal((await api("POST", "/auth/login/verify-code", { body: { ...creds, code: codes["priya@pulse.io:login"] } })).status, 400);
});

test("legacy userId login is gone", async () => {
  assert.equal((await api("POST", "/auth/login", { body: { userId: u.admin } })).status, 404);
});

test("admin creates employees; others cannot", async () => {
  const people = [
    ["pm", "Rohan Mehta", "rohan@pulse.io", "Project Manager"],
    ["member", "Aisha Khan", "aisha@pulse.io", "Team Member"],
    ["other", "Dev Patel", "dev@pulse.io", "Team Member"],
    ["qa", "Meera Nair", "meera@pulse.io", "Team Member"],
  ];
  for (const [key, name, email, role] of people) {
    const r = await api("POST", "/users", { token: t.admin, body: { name, email, role } });
    assert.equal(r.status, 201);
    u[key] = r.body.user.id;
    t[key] = await onboard(name, email);
  }
  assert.equal((await api("POST", "/users", { token: t.admin, body: { name: "X", email: "rohan@pulse.io", role: "Team Member" } })).status, 409);
  assert.equal((await api("POST", "/users", { token: t.admin, body: { name: "X", email: "x@acme.com", role: "Client" } })).status, 400);
  assert.equal((await api("POST", "/users", { token: t.pm, body: { name: "X", email: "x@x.io", role: "Admin" } })).status, 403);
  assert.equal((await api("PATCH", `/users/${u.member}`, { token: t.admin, body: { role: "Overlord" } })).status, 400);
});

test("user listing never exposes password hashes and is scoped", async () => {
  const all = await api("GET", "/users", { token: t.admin });
  assert.equal(all.body.length, 5);
  assert.ok(all.body.every((x) => x.passwordHash === undefined && x.tokenVersion === undefined && x.id));
  const mine = await api("GET", "/users", { token: t.other });
  assert.deepEqual(mine.body.map((x) => x.id), [u.other]);
});

test("projects: members only, managers manage, no mass assignment", async () => {
  const p = await api("POST", "/projects", { token: t.pm, body: { name: "Acme Revamp", memberIds: [u.member, u.qa], _id: "x", createdBy: u.other } });
  assert.equal(p.status, 201);
  assert.ok(p.body.memberIds.includes(u.pm));
  assert.equal(p.body.createdBy, u.pm);
  t.projectId = p.body.id;

  assert.equal((await api("POST", "/projects", { token: t.member, body: { name: "Nope" } })).status, 403);
  // Admin manages people only: no creating, editing or staffing projects
  assert.equal((await api("POST", "/projects", { token: t.admin, body: { name: "Nope" } })).status, 403);
  assert.equal((await api("GET", `/projects/${t.projectId}`, { token: t.admin })).status, 200);
  assert.equal((await api("PATCH", `/projects/${t.projectId}`, { token: t.admin, body: { name: "X" } })).status, 403);
  assert.equal((await api("POST", `/projects/${t.projectId}/members`, { token: t.admin, body: { userId: u.other } })).status, 403);
  // PMs can only staff their projects with Team Members
  assert.equal((await api("POST", `/projects/${t.projectId}/members`, { token: t.pm, body: { userId: u.admin } })).status, 400);
  assert.equal((await api("POST", "/projects", { token: t.pm, body: { name: "Bad", memberIds: [u.admin] } })).status, 400);
  assert.equal((await api("GET", `/projects/${t.projectId}`, { token: t.other })).status, 404);
  assert.equal((await api("GET", `/projects/${t.projectId}`, { token: t.qa })).status, 200);
  assert.equal((await api("PATCH", `/projects/${t.projectId}`, { token: t.member, body: { name: "Hijack" } })).status, 403);

  const up = await api("PATCH", `/projects/${t.projectId}`, { token: t.pm, body: { description: "Storefront", memberIds: [] } });
  assert.equal(up.body.description, "Storefront");
  assert.equal(up.body.memberIds.length, 3);
  assert.equal((await api("PATCH", `/projects/${t.projectId}/status`, { token: t.pm, body: { status: "Bogus" } })).status, 400);
  assert.equal((await api("GET", "/projects/not-an-id", { token: t.pm })).status, 400);
});

test("tasks: permissions, validation, review workflow, dependencies", async () => {
  const pid = t.projectId;
  const a = await api("POST", "/tasks", { token: t.pm, body: { projectId: pid, title: "Checkout form", assigneeId: u.member, priority: "High" } });
  assert.equal(a.status, 201);
  assert.equal((await api("POST", "/tasks", { token: t.pm, body: { projectId: pid, title: "x", priority: "Urgent" } })).status, 400);
  assert.equal((await api("POST", "/tasks", { token: t.pm, body: { projectId: pid, title: "x", assigneeId: u.other } })).status, 400);
  assert.equal((await api("POST", "/tasks", { token: t.member, body: { projectId: pid, title: "x", assigneeId: u.pm } })).status, 403);
  assert.equal((await api("POST", "/tasks", { token: t.other, body: { projectId: pid, title: "x" } })).status, 404);

  const bug = await api("POST", "/tasks", { token: t.member, body: { projectId: pid, title: "Crash on pay", type: "Bug", severity: "High" } });
  assert.equal(bug.status, 201);
  assert.equal(bug.body.reporterId, u.member);

  // Outsiders can neither see nor touch the project's tasks
  assert.equal((await api("GET", `/tasks?projectId=${pid}`, { token: t.other })).body.length, 0);
  assert.equal((await api("GET", `/tasks/${a.body.id}`, { token: t.other })).status, 404);
  assert.equal((await api("DELETE", `/tasks/${a.body.id}`, { token: t.other })).status, 404);

  // Mass assignment is ignored; status cannot be changed via general PATCH
  const patched = await api("PATCH", `/tasks/${a.body.id}`, { token: t.member, body: { description: "multi-step", projectId: "000000000000000000000000", status: "Completed" } });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.projectId, pid);
  assert.equal(patched.body.status, "To Do");
  assert.equal((await api("PATCH", `/tasks/${a.body.id}`, { token: t.member, body: { assigneeId: u.pm } })).status, 403);

  // Dependencies block progress and reject cycles
  const b = await api("POST", "/tasks", { token: t.pm, body: { projectId: pid, title: "Payment retry", assigneeId: u.member, dependsOn: [a.body.id] } });
  assert.equal(b.status, 201);
  assert.equal((await api("PATCH", `/tasks/${a.body.id}`, { token: t.pm, body: { dependsOn: [b.body.id] } })).status, 400);
  assert.equal((await api("PATCH", `/tasks/${b.body.id}/status`, { token: t.member, body: { status: "In Progress" } })).status, 409);

  // Review workflow
  assert.equal((await api("PATCH", `/tasks/${a.body.id}/status`, { token: t.qa, body: { status: "In Progress" } })).status, 403);
  assert.equal((await api("PATCH", `/tasks/${a.body.id}/status`, { token: t.member, body: { status: "Completed" } })).status, 403);
  assert.equal((await api("PATCH", `/tasks/${a.body.id}/status`, { token: t.member, body: { status: "Under Review" } })).status, 200);
  const pmNotes = await api("GET", "/notifications", { token: t.pm });
  assert.ok(pmNotes.body.some((n) => n.type === "review"));
  const done = await api("PATCH", `/tasks/${a.body.id}/status`, { token: t.pm, body: { status: "Completed" } });
  assert.ok(done.body.completedAt);
  assert.equal((await api("PATCH", `/tasks/${b.body.id}/status`, { token: t.member, body: { status: "In Progress" } })).status, 200);

  // Comments, mentions, time
  assert.equal((await api("POST", `/tasks/${a.body.id}/comments`, { token: t.member, body: {} })).status, 400);
  assert.equal((await api("POST", `/tasks/${a.body.id}/comments`, { token: t.qa, body: { text: "Looks good @Rohan Mehta" } })).status, 201);
  assert.ok((await api("GET", "/notifications", { token: t.pm })).body.some((n) => n.type === "mention"));
  assert.equal((await api("POST", `/tasks/${b.body.id}/time-log`, { token: t.member, body: { hours: -3 } })).status, 400);
  assert.equal((await api("POST", `/tasks/${b.body.id}/time-log`, { token: t.member, body: { hours: 2.5 } })).body.timeLogged, 2.5);

  // Query values are plain strings (no operator injection)
  const allTasks = (await api("GET", "/tasks", { token: t.pm })).body.length;
  assert.equal((await api("GET", `/tasks?status[$ne]=x`, { token: t.pm })).body.length, allTasks); // unknown param, ignored
  assert.equal((await api("GET", `/tasks?status=Completed`, { token: t.pm })).body.length, 1);
  assert.equal((await api("GET", `/tasks?q=pay&type=Bug`, { token: t.pm })).body.length, 1);

  // Deleting a task removes it from other tasks' dependencies
  assert.equal((await api("DELETE", `/tasks/${a.body.id}`, { token: t.member })).status, 403);
  assert.equal((await api("DELETE", `/tasks/${a.body.id}`, { token: t.pm })).status, 204);
  assert.deepEqual((await api("GET", `/tasks/${b.body.id}`, { token: t.pm })).body.dependsOn, []);

  const activity = await api("GET", `/activity?projectId=${pid}`, { token: t.qa });
  assert.ok(activity.body.length > 5);
  assert.equal((await api("GET", `/activity?projectId=${pid}`, { token: t.other })).status, 404);
});

test("calendar dates are YYYY-MM-DD; templates, milestones, sprints and meetings round-trip", async () => {
  const p = await api("POST", "/projects", {
    token: t.pm,
    body: {
      name: "Template project", startDate: "2026-10-01", endDate: "2026-10-31T00:00:00.000Z", memberIds: [u.member],
      milestones: [{ id: "m_1", name: "Beta", date: "2026-10-10", done: false }],
      sprints: [{ id: "s_1", name: "Sprint 1", start: "2026-10-01", end: "2026-10-14", status: "Active" }],
    },
  });
  assert.equal(p.status, 201);
  assert.equal(p.body.endDate, "2026-10-31");
  assert.equal(p.body.sprints[0].start, "2026-10-01");
  const pid = p.body.id;

  // Replacing milestones keeps existing ids
  const ms = p.body.milestones[0];
  const up = await api("PATCH", `/projects/${pid}`, { token: t.pm, body: { milestones: [{ ...ms, done: true }, { name: "GA", date: "2026-10-30" }] } });
  assert.equal(up.body.milestones[0].id, ms.id);
  assert.equal(up.body.milestones[0].done, true);
  assert.equal((await api("PATCH", `/projects/${pid}`, { token: t.pm, body: { endDate: "31/10/2026" } })).status, 400);

  const sprint = await api("PATCH", `/projects/${pid}/sprints/${p.body.sprints[0].id}`, { token: t.pm, body: { status: "Completed" } });
  assert.equal(sprint.body.status, "Completed");

  const mt = await api("POST", `/projects/${pid}/meetings`, {
    token: t.pm,
    body: { title: "Standup", date: "2026-10-02", time: "10:00", attendeeIds: [u.member], actionItems: [{ id: "ai_1", text: "Fix CI", done: false }] },
  });
  assert.equal(mt.status, 201);
  assert.equal(mt.body.time, "10:00");
  const item = mt.body.actionItems[0];
  const mt2 = await api("PATCH", `/projects/${pid}/meetings/${mt.body.id}`, { token: t.pm, body: { actionItems: [{ ...item, done: true }] } });
  assert.equal(mt2.body.actionItems[0].id, item.id);
  assert.equal(mt2.body.actionItems[0].done, true);
  assert.equal((await api("PATCH", `/projects/${pid}/meetings/${mt.body.id}`, { token: t.member, body: { notes: "x" } })).status, 403);

  const risk = await api("POST", `/projects/${pid}/risks`, { token: t.pm, body: { title: "Vendor", impact: "Critical", mitigation: "Backup" } });
  assert.equal(risk.status, 201);
});

test("recurring tasks create their next occurrence on completion", async () => {
  const task = await api("POST", "/tasks", {
    token: t.pm,
    body: { projectId: t.projectId, title: "Weekly report", type: "Documentation", dueDate: "2026-10-05", assigneeId: u.member, recurring: { enabled: true, freq: "Monthly" } },
  });
  assert.equal(task.status, 201);
  assert.equal(task.body.dueDate, "2026-10-05");
  const done = await api("PATCH", `/tasks/${task.body.id}/status`, { token: t.pm, body: { status: "Completed" } });
  assert.equal(done.body.status, "Completed");
  assert.equal(done.body.nextOccurrence.dueDate, "2026-11-05");
  assert.equal(done.body.nextOccurrence.status, "To Do");
  assert.equal((await api("GET", `/tasks?dueAfter=2026-11-01&dueBefore=2026-11-30`, { token: t.pm })).body.length, 1);
});

test("project managers see all active employees; ratings return the user", async () => {
  assert.equal((await api("GET", "/users", { token: t.pm })).body.length, 5);
  const r = await api("POST", `/users/${u.member}/ratings`, { token: t.pm, body: { projectId: t.projectId, rating: 4 } });
  assert.equal(r.status, 201);
  assert.equal(r.body.id, u.member);
  assert.equal(r.body.ratings.length, 1);
});

test("attachments: file upload, links, signed download, delete", async () => {
  // Stand-in for Cloudinary
  const storage = require("../src/utils/storage");
  const stored = new Set();
  storage.uploadFile = async (file, taskId) => {
    const publicId = `pulse/tasks/${taskId}/${file.originalname}`;
    stored.add(publicId);
    return { publicId };
  };
  storage.downloadUrl = (publicId) => `https://signed.example/${publicId}?expires=1`;
  storage.deleteFile = async (publicId) => stored.delete(publicId);

  const task = await api("POST", "/tasks", { token: t.pm, body: { projectId: t.projectId, title: "Spec review", assigneeId: u.member } });
  const upload = (token, name, bytes) => {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "application/pdf" }), name);
    return fetch(`${base}/tasks/${task.body.id}/attachments`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form })
      .then(async (r) => ({ status: r.status, body: await r.json() }));
  };

  const file = await upload(t.member, "spec.pdf", "%PDF-1.4 hello");
  assert.equal(file.status, 201);
  assert.equal(file.body.name, "spec.pdf");
  assert.equal(file.body.mimeType, "application/pdf");
  assert.equal((await upload(t.other, "x.pdf", "x")).status, 404);

  const dl = await api("GET", `/tasks/${task.body.id}/attachments/${file.body.id}/download`, { token: t.pm });
  assert.match(dl.body.url, /^https:\/\/signed\.example\/pulse\/tasks\//);
  assert.equal((await api("GET", `/tasks/${task.body.id}/attachments/${file.body.id}/download`, { token: t.other })).status, 404);

  assert.equal((await api("POST", `/tasks/${task.body.id}/attachments`, { token: t.member, body: { url: "javascript:alert(1)" } })).status, 400);
  const link = await api("POST", `/tasks/${task.body.id}/attachments`, { token: t.member, body: { url: "https://docs.example/spec" } });
  assert.equal(link.status, 201);
  assert.equal((await api("GET", `/tasks/${task.body.id}/attachments/${link.body.id}/download`, { token: t.member })).body.url, "https://docs.example/spec");

  // Only the uploader or a manager may delete; deleting removes the stored file
  assert.equal((await api("DELETE", `/tasks/${task.body.id}/attachments/${file.body.id}`, { token: t.qa })).status, 403);
  assert.equal((await api("DELETE", `/tasks/${task.body.id}/attachments/${file.body.id}`, { token: t.pm })).status, 204);
  assert.equal(stored.size, 0);

  // Deleting the task cleans up its remaining files
  await upload(t.member, "notes.pdf", "x");
  assert.equal(stored.size, 1);
  assert.equal((await api("DELETE", `/tasks/${task.body.id}`, { token: t.pm })).status, 204);
  assert.equal(stored.size, 0);
});

test("notifications are private", async () => {
  const [n] = (await api("GET", "/notifications", { token: t.pm })).body;
  assert.equal((await api("PATCH", `/notifications/${n.id}/read`, { token: t.other })).status, 404);
  assert.equal((await api("PATCH", `/notifications/${n.id}/read`, { token: t.pm })).body.read, true);
});

test("forgot password resets and revokes old sessions", async () => {
  const creds = { name: "Aisha Khan", email: "aisha@pulse.io" };
  const old = t.member;
  assert.equal((await api("POST", "/auth/forgot-password/request-code", { body: creds })).status, 200);
  const v = await api("POST", "/auth/forgot-password/verify-code", { body: { ...creds, code: codes["aisha@pulse.io:forgot"] } });
  assert.equal(v.status, 200);
  // A reset token is not a session token
  assert.equal((await api("GET", "/auth/me", { token: v.body.tempToken })).status, 401);
  const r = await api("POST", "/auth/forgot-password/reset", { body: { tempToken: v.body.tempToken, newPassword: "newpassword1" } });
  assert.equal(r.status, 200);
  assert.equal((await api("GET", "/auth/me", { token: old })).status, 401);
  assert.equal((await api("GET", "/auth/me", { token: r.body.token })).status, 200);
  t.member = r.body.token;
});

test("change password while logged in uses the same code procedure", async () => {
  assert.equal((await api("POST", "/auth/change-password/request-code", { token: t.pm })).status, 200);
  const v = await api("POST", "/auth/change-password/verify-code", { token: t.pm, body: { code: codes["rohan@pulse.io:change"] } });
  assert.equal(v.status, 200);
  const r = await api("POST", "/auth/change-password/reset", { body: { tempToken: v.body.tempToken, newPassword: "anotherpass1" } });
  assert.equal(r.status, 200);
  t.pm = r.body.token;
});

test("logout and deactivation revoke access", async () => {
  assert.equal((await api("POST", "/auth/logout", { token: t.other })).status, 200);
  assert.equal((await api("GET", "/auth/me", { token: t.other })).status, 401);

  assert.equal((await api("PATCH", `/users/${u.qa}`, { token: t.admin, body: { active: false } })).status, 200);
  assert.equal((await api("GET", "/auth/me", { token: t.qa })).status, 401);
  const r = await api("POST", "/auth/login/request-code", { body: { name: "Meera Nair", email: "meera@pulse.io", password: "password123" } });
  assert.equal(r.status, 401);
  assert.equal((await api("PATCH", `/users/${u.admin}`, { token: t.admin, body: { active: false } })).status, 400);
});

test("projects can start without Team Members; the creating PM's own id is accepted in memberIds", async () => {
  const empty = await api("POST", "/projects", { token: t.pm, body: { name: "Empty" } });
  assert.equal(empty.status, 201);
  assert.deepEqual(empty.body.memberIds, [u.pm]);
  const own = await api("POST", "/projects", { token: t.pm, body: { name: "Only me", memberIds: [u.pm] } });
  assert.equal(own.status, 201);
  assert.deepEqual(own.body.memberIds, [u.pm]);
  const p = await api("POST", "/projects", { token: t.pm, body: { name: "Solo", memberIds: [u.pm, u.member] } });
  assert.equal(p.status, 201);
  assert.equal(p.body.methodology, "Agile");
  assert.equal((await api("DELETE", `/projects/${p.body.id}/members/${u.member}`, { token: t.pm })).status, 200);
});

test("waterfall: phases run in order and gate task progress", async () => {
  const p = await api("POST", "/projects", { token: t.pm, body: { name: "WF", methodology: "Waterfall", memberIds: [u.member], startDate: "2026-01-01", endDate: "2026-06-30" } });
  assert.equal(p.status, 201);
  const [req, design] = p.body.sprints;
  assert.equal(p.body.sprints.length, 5);
  assert.deepEqual(p.body.sprints.map((s) => s.status), ["Active", "Planned", "Planned", "Planned", "Planned"]);

  // Tasks default to the current phase; tasks in a later phase cannot start yet
  const a = await api("POST", "/tasks", { token: t.pm, body: { projectId: p.body.id, title: "Spec", assigneeId: u.member } });
  assert.equal(a.body.sprintId, req.id);
  const b = await api("POST", "/tasks", { token: t.pm, body: { projectId: p.body.id, title: "Mockups", sprintId: design.id } });
  assert.equal((await api("PATCH", `/tasks/${b.body.id}/status`, { token: t.pm, body: { status: "In Progress" } })).status, 409);
  assert.equal((await api("PATCH", `/projects/${p.body.id}/sprints/${design.id}`, { token: t.pm, body: { status: "Active" } })).status, 409);
  assert.equal((await api("PATCH", `/projects/${p.body.id}/sprints/${req.id}`, { token: t.pm, body: { status: "Completed" } })).status, 409);

  assert.equal((await api("PATCH", `/tasks/${a.body.id}/status`, { token: t.pm, body: { status: "Completed" } })).status, 200);
  assert.equal((await api("PATCH", `/projects/${p.body.id}/sprints/${req.id}`, { token: t.pm, body: { status: "Completed" } })).status, 200);
  const after = await api("GET", `/projects/${p.body.id}`, { token: t.pm });
  assert.equal(after.body.sprints[1].status, "Active");
  assert.equal((await api("PATCH", `/tasks/${b.body.id}/status`, { token: t.pm, body: { status: "In Progress" } })).status, 200);
});

test("iterative: one iteration at a time, unfinished work carries over", async () => {
  assert.equal((await api("POST", "/projects", { token: t.pm, body: { name: "X", methodology: "Spiral", memberIds: [u.member] } })).status, 400);
  const p = await api("POST", "/projects", { token: t.pm, body: { name: "IT", methodology: "Iterative", memberIds: [u.member] } });
  const [i1, i2] = p.body.sprints;
  assert.equal(p.body.sprints.length, 3);
  const a = await api("POST", "/tasks", { token: t.pm, body: { projectId: p.body.id, title: "Backlog item" } });
  assert.equal((await api("PATCH", `/tasks/${a.body.id}/status`, { token: t.pm, body: { status: "In Progress" } })).status, 409);
  await api("PATCH", `/tasks/${a.body.id}`, { token: t.pm, body: { sprintId: i1.id } });
  assert.equal((await api("PATCH", `/tasks/${a.body.id}/status`, { token: t.pm, body: { status: "In Progress" } })).status, 200);
  assert.equal((await api("PATCH", `/projects/${p.body.id}/sprints/${i1.id}`, { token: t.pm, body: { status: "Completed" } })).status, 200);
  assert.equal((await api("GET", `/tasks/${a.body.id}`, { token: t.pm })).body.sprintId, i2.id);
});
