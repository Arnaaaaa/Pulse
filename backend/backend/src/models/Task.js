const { Schema, model } = require("mongoose");
const { STATUSES, PRIORITIES, SEVERITIES, TASK_TYPES, RECURRING_FREQS } = require("../constants");
const { dateOnly } = require("./dateOnly");

const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });

const taskSchema = new Schema(
  {
    projectId: { ...ref("Project"), required: true, index: true },
    sprintId: { type: Schema.Types.ObjectId, default: null }, // a sprint subdocument of the project; null = backlog
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: { type: String, enum: TASK_TYPES, default: "Task" },
    severity: { type: String, enum: [...SEVERITIES, null], default: null },
    status: { type: String, enum: STATUSES, default: "To Do" },
    priority: { type: String, enum: PRIORITIES, default: "Medium" },
    assigneeId: { ...ref("User"), default: null, index: true },
    reporterId: ref("User"),
    dueDate: dateOnly(),
    completedAt: { type: Date, default: null },
    tags: [String],
    subtasks: [new Schema({ text: { type: String, required: true }, done: { type: Boolean, default: false } })],
    comments: [
      new Schema({
        userId: ref("User"),
        text: { type: String, required: true },
        date: { type: Date, default: Date.now },
      }),
    ],
    attachments: [
      new Schema({
        name: { type: String, required: true },
        url: { type: String, default: "" }, // external link
        publicId: { type: String, default: null }, // uploaded file in Cloudinary
        size: { type: Number, default: null },
        mimeType: { type: String, default: null },
        uploadedBy: ref("User"),
        date: { type: Date, default: Date.now },
      }),
    ],
    dependsOn: [ref("Task")],
    estimate: { type: Number, min: 0, default: 4 },
    timeLogged: { type: Number, min: 0, default: 0 },
    timeLogs: [
      new Schema({
        userId: ref("User"),
        hours: { type: Number, required: true },
        note: { type: String, default: "" },
        date: { type: Date, default: Date.now },
      }),
    ],
    recurring: {
      enabled: { type: Boolean, default: false },
      freq: { type: String, enum: RECURRING_FREQS, default: "Weekly" },
    },
  },
  { timestamps: true }
);

module.exports = model("Task", taskSchema);
