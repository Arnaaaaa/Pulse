const { Schema, model } = require("mongoose");
const { ROLES } = require("../constants");

const ratingSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  raterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  feedback: { type: String, default: "" },
  date: { type: Date, default: Date.now },
});

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ROLES, required: true },
    title: { type: String, default: "" },
    color: { type: String, default: "#4C5FD5" },
    active: { type: Boolean, default: true },
    passwordHash: { type: String, default: null, select: false },
    isPasswordSet: { type: Boolean, default: false },
    // Bumped on logout, password change, role change and deactivation to revoke issued JWTs
    tokenVersion: { type: Number, default: 0, select: false },
    ratings: [ratingSchema],
  },
  { timestamps: true }
);

module.exports = model("User", userSchema);
