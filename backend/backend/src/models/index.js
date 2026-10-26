const mongoose = require("mongoose");

// Every document (and subdocument) is sent to clients with a string `id` instead of `_id`,
// and never with credentials.
mongoose.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    delete ret._id;
    delete ret.passwordHash;
    delete ret.tokenVersion;
    return ret;
  },
});

module.exports = {
  User: require("./User"),
  Project: require("./Project"),
  Task: require("./Task"),
  Notification: require("./Notification"),
  Activity: require("./Activity"),
  Otp: require("./Otp"),
};
