const { Schema, model } = require("mongoose");

// Doubles as the audit trail: who did what and when, plus optional details such as changed fields.
const activitySchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = model("Activity", activitySchema);
