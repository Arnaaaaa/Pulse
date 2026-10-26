const path = require("path");
const dotenv = require("dotenv");
// Load env from config/config.env (primary) and .env (fallback)
dotenv.config({ path: path.join(__dirname, "config", "config.env") });
dotenv.config();

const connectDatabase = require("./config/database");
const app = require("./src/app");

async function start() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set (config/config.env)");
  await connectDatabase();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`PULSE API listening on http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
