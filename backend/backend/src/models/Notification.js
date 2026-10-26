const { Schema, model } = require("mongoose");

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true },
    type: { type: String, default: "info" },
    read: { type: Boolean, default: false },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
  },
  { timestamps: true }
);

module.exports = model("Notification", notificationSchema);
