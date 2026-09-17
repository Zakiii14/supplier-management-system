const pool = require("../config/database");

const DEMO_RESET_LOCK_KEY = 420260916;

// Transaction-scoped locks also work through Neon's transaction pooler.
// Login, heartbeat, logout and reset must all acquire this same lock.
const lockDemoTransaction = (client) =>
  client.query("SELECT pg_advisory_xact_lock($1)", [DEMO_RESET_LOCK_KEY]);

const withDemoTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockDemoTransaction(client);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { DEMO_RESET_LOCK_KEY, lockDemoTransaction, withDemoTransaction };
