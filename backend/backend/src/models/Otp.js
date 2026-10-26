const { Schema, model } = require("mongoose");

// One pending code per (email, purpose). Only a hash of the code is stored.
const otpSchema = new Schema(
  {
    email: { type: String, required: true },
    purpose: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB deletes expired codes

module.exports = model("Otp", otpSchema);
