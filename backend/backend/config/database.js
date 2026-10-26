const dns = require("dns");
const mongoose = require("mongoose");

// Atlas "mongodb+srv://" addresses need a DNS SRV lookup. On some networks Node's own resolver
// cannot do that (querySrv ECONNREFUSED) even though Windows can, so we retry via public DNS.
const FALLBACK_DNS = ["1.1.1.1", "8.8.8.8"];

async function connectDatabase(uri = process.env.MONGO_URI) {
  if (!uri) throw new Error("MONGO_URI is not set (config/config.env)");
  const options = { dbName: process.env.MONGO_DB_NAME || "pulse", serverSelectionTimeoutMS: 15000 };
  let con;
  try {
    con = await mongoose.connect(uri, options);
  } catch (err) {
    if (!/querySrv|ENOTFOUND|ECONNREFUSED/.test(err.message) || !uri.startsWith("mongodb+srv://")) throw err;
    console.warn(`DNS lookup for MongoDB failed (${err.message}); retrying with public DNS ${FALLBACK_DNS.join(", ")}`);
    dns.setServers(FALLBACK_DNS);
    con = await mongoose.connect(uri, options);
  }
  console.log(`MongoDB connected: ${con.connection.host}/${con.connection.name}`);
  return con;
}

module.exports = connectDatabase;
