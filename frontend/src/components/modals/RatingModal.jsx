import React, { useState } from "react";
import { Star } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { Modal, UserAvatar } from "../ui/Primitives";

export function RatingModal() {
  const {
    ratingModalProject,
    setRatingModalProject,
    users,
    currentUser,
    addUserRating,
    showToast,
  } = useApp();

  const [scores, setScores] = useState({});
  const [feedbackMap, setFeedbackMap] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (!ratingModalProject) return null;

  const teamMembers = (ratingModalProject.memberIds || [])
    .map((id) => users.find((u) => u.id === id))
    .filter((u) => u && u.id !== currentUser?.id); // no self-ratings

  const handleRateChange = (userId, rating) => {
    setScores((prev) => ({ ...prev, [userId]: rating }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const entries = Object.entries(scores).filter(([, r]) => Number(r) > 0);
    const failed = {};
    for (const [userId, rating] of entries) {
      const saved = await addUserRating(userId, {
        projectId: ratingModalProject.id,
        rating: Number(rating),
        feedback: feedbackMap[userId] || "",
      });
      if (!saved) failed[userId] = rating;
    }
    setSubmitting(false);
    const savedCount = entries.length - Object.keys(failed).length;
    if (savedCount > 0) showToast(`Saved ratings for ${savedCount} team member(s)`, "success");
    // Keep unsaved ratings on screen so they can be retried
    setScores(failed);
    if (Object.keys(failed).length === 0) {
      setRatingModalProject(null);
      setFeedbackMap({});
    }
  };

  return (
    <Modal
      open={Boolean(ratingModalProject)}
      onClose={() => setRatingModalProject(null)}
      title={`Team Performance Review — ${ratingModalProject.name}`}
      width="560px"
    >
      <form onSubmit={handleSubmit}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0 }}>
          Rate team members on their contributions to <strong>{ratingModalProject.name}</strong>.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {teamMembers.map((member) => {
            const currentScore = scores[member.id] || 0;
            return (
              <div
                key={member.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <UserAvatar user={member} size={30} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{member.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {member.title}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="icon-btn"
                        style={{
                          width: 28,
                          height: 28,
                          color: star <= currentScore ? "#f59e0b" : "var(--text-muted)",
                        }}
                        onClick={() => handleRateChange(member.id, star)}
                      >
                        <Star size={15} fill={star <= currentScore ? "#f59e0b" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional feedback..."
                  value={feedbackMap[member.id] || ""}
                  onChange={(e) =>
                    setFeedbackMap((prev) => ({ ...prev, [member.id]: e.target.value }))
                  }
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRatingModalProject(null)}
          >
            Skip
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Ratings"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
