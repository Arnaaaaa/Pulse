const { Schema, model } = require("mongoose");
const { PROJECT_STATUSES, SPRINT_STATUSES, LEVELS, IMPACTS, RISK_STATUSES, METHODOLOGIES } = require("../constants");
const { dateOnly, todayISO } = require("./dateOnly");

const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });

const milestoneSchema = new Schema({
  name: { type: String, required: true },
  date: dateOnly(),
  done: { type: Boolean, default: false },
});

const sprintSchema = new Schema({
  name: { type: String, required: true },
  goal: { type: String, default: "" },
  start: dateOnly(),
  end: dateOnly(),
  status: { type: String, enum: SPRINT_STATUSES, default: "Planned" },
});

const riskSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  probability: { type: String, enum: LEVELS, default: "Medium" },
  impact: { type: String, enum: IMPACTS, default: "Medium" },
  mitigation: { type: String, default: "" },
  ownerId: { ...ref("User"), default: null },
  status: { type: String, enum: RISK_STATUSES, default: "Open" },
});

const meetingSchema = new Schema({
  title: { type: String, required: true },
  date: dateOnly(),
  time: { type: String, match: [/^\d{2}:\d{2}$/, "time must be HH:MM"], default: null },
  notes: { type: String, default: "" },
  attendeeIds: [ref("User")],
  actionItems: [
    new Schema({
      text: { type: String, required: true },
      ownerId: { ...ref("User"), default: null },
      done: { type: Boolean, default: false },
    }),
  ],
});

const announcementSchema = new Schema({
  authorId: ref("User"),
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    client: { type: String, default: "Internal" },
    description: { type: String, default: "" },
    status: { type: String, enum: PROJECT_STATUSES, default: "Active" },
    template: { type: String, default: "Blank" },
    // How work is organised: Agile sprints, sequential Waterfall phases, or Iterative cycles.
    // `sprints` holds the sprints / phases / iterations, in order.
    methodology: { type: String, enum: METHODOLOGIES, default: "Agile" },
    startDate: dateOnly({ default: todayISO }),
    endDate: dateOnly(),
    memberIds: { type: [ref("User")], index: true },
    tags: [String],
    milestones: [milestoneSchema],
    sprints: [sprintSchema],
    risks: [riskSchema],
    meetings: [meetingSchema],
    announcements: [announcementSchema],
    createdBy: ref("User"),
  },
  { timestamps: true }
);

module.exports = model("Project", projectSchema);
