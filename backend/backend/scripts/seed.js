// Creates the first System Admin from ADMIN_NAME / ADMIN_EMAIL, so there is someone to add employees.
// The admin then signs in through the New User flow (name + email -> code -> set password).
// Usage: npm run seed
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", "config.env") });
require("dotenv").config();

const mongoose = require("mongoose");
const connectDatabase = require("../config/database");
const { User } = require("../src/models");

async function main() {
  const { ADMIN_NAME, ADMIN_EMAIL } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL) throw new Error("Set ADMIN_NAME and ADMIN_EMAIL in config/config.env");
  await connectDatabase();
  await User.syncIndexes();

  const existing = await User.findOne({ email: ADMIN_EMAIL.trim().toLowerCase() });
  if (existing) {
    console.log(`User ${existing.email} already exists (role: ${existing.role}). Nothing to do.`);
  } else {
    const admin = await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, role: "Admin", title: "System Admin" });
    console.log(`Created admin ${admin.name} <${admin.email}>. Sign in with the New User flow to set a password.`);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
