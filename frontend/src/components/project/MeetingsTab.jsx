import React, { useState } from "react";
import { Calendar, Clock, Plus, CheckSquare } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { todayISO } from "../../constants/seedMeta";
import { UserAvatar, EmptyState } from "../ui/Primitives";

export function MeetingsTab({ project }) {
  const {
    users,
    canManageProject,
    createMeeting,
    updateMeeting,
  } = useApp();

  const manageable = canManageProject(project);
  const meetings = project.meetings || [];
  const projectMembers = users.filter((u) => (project.memberIds || []).includes(u.id));

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [attendees, setAttendees] = useState(project.memberIds || []);
  const [actionItemsRaw, setActionItemsRaw] = useState("");

  const toggleAttendee = (userId) => {
    setAttendees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const actionItems = actionItemsRaw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ text, done: false }));

    const created = await createMeeting(project.id, {
      title: title.trim(),
      date,
      time,
      notes: notes.trim(),
      attendeeIds: attendees.filter((id) => (project.memberIds || []).includes(id)),
      actionItems,
    });
    if (!created) return;
    setTitle("");
    setNotes("");
    setActionItemsRaw("");
    setShowForm(false);
  };

  const handleToggleActionItem = async (meeting, itemId) => {
    await updateMeeting(project.id, meeting.id, {
      actionItems: (meeting.actionItems || []).map((ai) => (ai.id === itemId ? { ...ai, done: !ai.done } : ai)),
    });
  };

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
          gap: 10,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            Meetings, Notes & Action Items ({meetings.length})
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
            Schedule standups, sprint reviews, and team syncs with shared notes and action checklists.
          </p>
        </div>

        {manageable && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus size={15} /> {showForm ? "Cancel" : "Schedule Meeting"}
          </button>
        )}
      </div>

      {showForm && manageable && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 12px" }}>Schedule Project Meeting</h4>
          <form onSubmit={handleSchedule}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Meeting Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Sprint 4 Review & Demo"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Time *</label>
                <input
                  type="time"
                  className="form-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Attendees</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 8, borderRadius: 6, backgroundColor: "var(--bg-subtle)" }}>
                {projectMembers.map((u) => (
                  <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={attendees.includes(u.id)}
                      onChange={() => toggleAttendee(u.id)}
                    />
                    <span>{u.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Meeting Agenda / Notes</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Agenda topics, decisions made, and discussion summary..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Action Items (one per line)</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder={"Update API gateway timeout\nShare staging credentials with QA"}
                value={actionItemsRaw}
                onChange={(e) => setActionItemsRaw(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-sm">
              Save Meeting
            </button>
          </form>
        </div>
      )}

      {meetings.length === 0 ? (
        <EmptyState
          title="No meetings scheduled yet"
          description="Schedule a sprint planning session, standup, or sprint review."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {meetings.map((mt) => {
            const mtUsers = (mt.attendeeIds || [])
              .map((id) => users.find((u) => u.id === id))
              .filter(Boolean);
            return (
              <div key={mt.id} className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 15.5 }}>{mt.title}</h4>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={13} /> {mt.date || "TBD"}
                    </span>
                    {mt.time && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock size={13} /> {mt.time}
                      </span>
                    )}
                  </div>
                </div>

                {mt.notes && (
                  <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                    {mt.notes}
                  </p>
                )}

                {(mt.actionItems || []).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckSquare size={14} /> Action Items
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {mt.actionItems.map((ai) => (
                        <label
                          key={ai.id || ai.text}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            borderRadius: 6,
                            backgroundColor: "var(--bg-subtle)",
                            cursor: "pointer",
                            textDecoration: ai.done ? "line-through" : "none",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(ai.done)}
                            disabled={!manageable}
                            onChange={() => handleToggleActionItem(mt, ai.id)}
                          />
                          <span style={{ fontSize: 13 }}>{ai.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {mtUsers.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Attendees:</span>
                    {mtUsers.map((u) => (
                      <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                        <UserAvatar user={u} size={20} /> {u.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
