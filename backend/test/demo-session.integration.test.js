const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");

require("dotenv").config({ path: path.resolve(__dirname, "../.env.test"), override: true });
if (process.env.DB_NAME !== "supplier_management_test") {
  throw new Error("Integration tests must use supplier_management_test");
}
const sourcePool = require("../src/config/database");
const { discoverMigrations } = require("../src/database/migrationFiles");
const { baselineLegacyMigrations, applyPendingMigrations } = require("../src/database/migrationRunner");
const databaseName = `supplier_management_session_test_${process.pid}`;
const password = "SessionTestOnly123!";
let pool, app, services, resetDemoDatabase, lockDemoTransaction, storageRoot;
let migrationHistory, migrations;
const login = (clientId = randomUUID()) => request(app).post("/api/auth/login").send({
  identifier: "demo_admin", password, client_id: clientId,
});
const auth = (response) => `Bearer ${response.body.data.access_token}`;
const clientIdOf = (response) => jwt.decode(response.body.data.access_token).demo_client_id;
const sessionOf = (response) => {
  const claims = jwt.decode(response.body.data.access_token);
  return { clientId: claims.demo_client_id, sessionId: claims.demo_session_id, userId: claims.sub };
};
const prepare = () => request(app).post("/api/demo-session/prepare");
const heartbeat = (response, clientId = clientIdOf(response)) => request(app)
  .post("/api/demo-session/heartbeat").set("Authorization", auth(response)).send({ client_id: clientId });
const end = (response) => request(app).post("/api/demo-session/end")
  .set("Authorization", auth(response)).send({ client_id: clientIdOf(response) });
const history = async () => (await pool.query("SELECT * FROM app.schema_migrations ORDER BY version")).rows;
const sessionCount = async () => Number((await pool.query("SELECT count(*) FROM app.demo_sessions")).rows[0].count);

before(async () => {
  // Never reset the developer's normal test fixtures, let alone their demo DB.
  const actual = (await sourcePool.query("SELECT current_database() AS name")).rows[0].name;
  assert.equal(actual, "supplier_management_test");
  await sourcePool.query(`CREATE DATABASE "${databaseName}"`);
  process.env.DB_NAME = databaseName;
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${databaseName}`;
    process.env.DATABASE_URL = url.toString();
  }
  delete require.cache[require.resolve("../src/config/database")];
  pool = require("../src/config/database");
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "supplyflow-session-test-"));
  Object.assign(process.env, {
    DEMO_MODE: "true", DEMO_RESET_ENABLED: "true", DEMO_IDLE_MINUTES: "15",
    DEMO_DATABASE_NAME: databaseName, DEMO_ACCOUNT_PASSWORD: password,
    FILE_STORAGE_PROVIDER: "filesystem", FILE_STORAGE_ROOT: storageRoot,
  });
  const client = await pool.connect();
  try {
    const schema = (await fs.readFile(path.resolve(__dirname, "../../database/schema.sql"), "utf8"))
      .replace(/^\\.*$/gm, "");
    await client.query(schema);
    migrations = discoverMigrations(path.resolve(__dirname, "../../database/migrations"));
    await baselineLegacyMigrations({ client, migrations, baselineVersion: 20 });
    const applied = await applyPendingMigrations({ client, migrations });
    assert.deepEqual(applied.map((m) => m.version), [21]);
    migrationHistory = await history();
  } finally {
    client.release();
  }
  ({ resetDemoDatabase } = require("../src/demo/demoResetService"));
  ({ lockDemoTransaction } = require("../src/demo/demoTransaction"));
  services = require("../src/services/demoSessionService");
  app = require("../src/app");
});

beforeEach(async () => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_RESET_ENABLED = "true";
  const client = await pool.connect();
  try { await resetDemoDatabase({ client, clearStorage: false }); }
  finally { client.release(); }
});

after(async () => {
  if (pool) await pool.end();
  await sourcePool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await sourcePool.end();
  if (storageRoot) await fs.rm(storageRoot, { recursive: true, force: true });
});

test("migration 021 applies once and complete migration history survives committed resets", async () => {
  const client = await pool.connect();
  try {
    assert.deepEqual(await applyPendingMigrations({ client, migrations }), []);
  } finally { client.release(); }
  assert.deepEqual(await history(), migrationHistory);
  const visitor = await login();
  assert.equal(visitor.status, 200);
  const response = await end(visitor);
  assert.equal(response.body.data.reset, false);
  assert.equal(response.body.data.reason, "grace_period");
  await pool.query("UPDATE app.demo_sessions SET last_seen_at = clock_timestamp() - INTERVAL '16 minutes'");
  const cleanup = await prepare();
  assert.equal(cleanup.body.data.reset, true);
  assert.deepEqual(await history(), migrationHistory);
});

test("full-access mode keeps old login behavior and hides all demo endpoints", async () => {
  process.env.DEMO_MODE = "false";
  const response = await request(app).post("/api/auth/login").send({ identifier: "demo_admin", password });
  assert.equal(response.status, 200);
  assert.equal(jwt.decode(response.body.data.access_token).demo_session_id, undefined);
  for (const route of ["prepare", "heartbeat", "end"]) {
    assert.equal((await request(app).post(`/api/demo-session/${route}`)).status, 404);
  }
  assert.equal(await sessionCount(), 0);
});

test("disabled reset and an unused demo never reset data", async () => {
  assert.equal((await prepare()).body.data.reason, "no_tracked_session");
  const visitor = await login();
  process.env.DEMO_RESET_ENABLED = "false";
  const response = await end(visitor);
  assert.equal(response.body.data.reason, "disabled");
  assert.equal(await sessionCount(), 1);
});

test("login rejects missing/invalid client IDs and bad credentials without registering a session", async () => {
  for (const clientId of [undefined, {}, "not-a-uuid"]) {
    const response = await login(clientId === undefined ? "" : clientId);
    assert.equal(response.status, 400);
  }
  const response = await request(app).post("/api/auth/login").send({
    identifier: "demo_admin", password: "incorrect", client_id: randomUUID(),
  });
  assert.equal(response.status, 401);
  assert.equal(await sessionCount(), 0);
});

test("successful login already has a tracked session and heartbeat cannot target another visitor", async () => {
  const first = await login();
  const second = await login();
  assert.equal(await sessionCount(), 2);
  assert.equal((await heartbeat(first)).status, 204);
  assert.equal((await heartbeat(first, clientIdOf(second))).status, 400);
  assert.equal((await heartbeat(first, {})).status, 400);
  assert.equal((await request(app).post("/api/demo-session/heartbeat").send({ client_id: randomUUID() })).status, 401);
  assert.equal((await prepare()).body.data.reason, "active_session");
});

test("one visitor logout preserves another visitor's data; last logout resets once", async () => {
  const first = await login();
  const second = await login();
  await pool.query("UPDATE app.products SET product_name = 'visitor work'");
  const response = await end(first);
  assert.equal(response.body.data.reset, false);
  assert.equal(response.body.data.reason, "active_session");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM app.products WHERE product_name = 'visitor work'")).rows[0].n, 5);
  assert.equal((await heartbeat(second)).status, 204);
  const lastLogout = await end(second);
  assert.equal(lastLogout.body.data.reset, false);
  assert.equal(lastLogout.body.data.reason, "grace_period");
  assert.equal(await sessionCount(), 2);
  assert.equal(
    (await pool.query("SELECT count(*)::int AS n FROM app.products WHERE product_name = 'visitor work'")).rows[0].n,
    5,
  );
  await pool.query("UPDATE app.demo_sessions SET last_seen_at = clock_timestamp() - INTERVAL '16 minutes'");
  const cleanup = await prepare();
  assert.equal(cleanup.body.data.reset, true);
  assert.equal(await sessionCount(), 0);
  assert.equal((await prepare()).body.data.reason, "no_tracked_session");
  assert.deepEqual(await history(), migrationHistory);
});

test("late heartbeat cannot revive logout or stale sessions, including after re-login in the same tab", async () => {
  const visitor = await login();
  const guard = await login();
  const oldSession = sessionOf(visitor);
  await end(visitor);
  await assert.rejects(() => services.touchDemoSession(oldSession), { statusCode: 401 });
  const next = await login(clientIdOf(visitor));
  assert.equal((await heartbeat(visitor)).status, 401);
  const lateEnd = await services.endDemoSession(oldSession);
  assert.equal(lateEnd.ended, false);
  assert.equal((await heartbeat(next)).status, 204);
  assert.equal((await heartbeat(guard)).status, 204);
  await pool.query("UPDATE app.demo_sessions SET last_seen_at = clock_timestamp() - INTERVAL '16 minutes' WHERE client_id = $1", [clientIdOf(next)]);
  assert.equal((await heartbeat(next)).status, 401);
  await assert.rejects(() => services.touchDemoSession(sessionOf(next)), { statusCode: 401 });
});

test("close-tab silence stays protected before timeout and resets after timeout", async () => {
  const visitor = await login();
  await pool.query("UPDATE app.demo_sessions SET last_seen_at = clock_timestamp() - INTERVAL '14 minutes'");
  assert.equal((await prepare()).body.data.reason, "active_session");
  await pool.query("UPDATE app.demo_sessions SET last_seen_at = clock_timestamp() - INTERVAL '15 minutes'");
  assert.equal((await prepare()).body.data.reset, true);
  assert.equal((await request(app).get("/api/auth/me").set("Authorization", auth(visitor))).status, 401);
  assert.equal((await prepare()).body.data.reason, "no_tracked_session");
});

// Hold the lock explicitly to create deterministic ordering. pg_locks proves
// the contender is waiting; this does not rely on racing arbitrary sleeps.
const waitForWaiters = async (count = 1) => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = 420260916 AND NOT granted",
    );
    if (rows[0].n >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("Expected demo transaction to wait for the reset lock");
};

test("reset waits for an in-flight heartbeat and rechecks the committed fresh session", async () => {
  const visitor = await login();
  const owner = await pool.connect();
  let pending;
  try {
    await owner.query("BEGIN");
    await lockDemoTransaction(owner);
    await owner.query("UPDATE app.demo_sessions SET last_seen_at = clock_timestamp() - INTERVAL '16 minutes'");
    // Simulate the final update of a heartbeat while the common lock is held.
    pending = services.maybeResetStaleDemo();
    await waitForWaiters();
    await owner.query("UPDATE app.demo_sessions SET last_seen_at = clock_timestamp() WHERE client_id = $1", [clientIdOf(visitor)]);
    await owner.query("COMMIT");
    assert.equal((await pending).reason, "active_session");
    assert.equal(await sessionCount(), 1);
  } finally {
    await owner.query("ROLLBACK");
    owner.release();
    if (pending) await pending;
  }
});

test("two simultaneous cleanup checks only perform one reset", async () => {
  await login();
  await pool.query("UPDATE app.demo_sessions SET last_seen_at = clock_timestamp() - INTERVAL '16 minutes'");
  const results = await Promise.all([services.maybeResetStaleDemo(), services.maybeResetStaleDemo()]);
  assert.equal(results.filter((r) => r.reset).length, 1);
  assert.equal(results.filter((r) => r.reason === "no_tracked_session").length, 1);
  assert.deepEqual(await history(), migrationHistory);
});

test("login queued behind a reset registers against the committed new database", async () => {
  await login();
  const owner = await pool.connect();
  let pending;
  try {
    await owner.query("BEGIN");
    await lockDemoTransaction(owner);
    pending = login().then((response) => response);
    await waitForWaiters();
    await resetDemoDatabase({ client: owner, clearStorage: false, manageTransaction: false });
    await owner.query("COMMIT");
    const response = await pending;
    assert.equal(response.status, 200);
    assert.equal((await heartbeat(response)).status, 204);
    assert.equal(await sessionCount(), 1);
  } finally {
    await owner.query("ROLLBACK");
    owner.release();
    if (pending) await pending;
  }
});

test("heartbeat queued behind logout cannot reopen that session", async () => {
  const visitor = await login();
  const owner = await pool.connect();
  let pending;
  try {
    await owner.query("BEGIN");
    await lockDemoTransaction(owner);
    await owner.query("UPDATE app.demo_sessions SET ended_at = clock_timestamp()");
    // Attach the rejection assertion immediately to avoid an unhandled rejection.
    pending = assert.rejects(() => services.touchDemoSession(sessionOf(visitor)), { statusCode: 401 });
    await waitForWaiters();
    await owner.query("COMMIT");
    await pending;
    assert.equal((await pool.query("SELECT ended_at IS NOT NULL AS ended FROM app.demo_sessions")).rows[0].ended, true);
  } finally {
    await owner.query("ROLLBACK");
    owner.release();
    if (pending) await pending;
  }
});

test("failed reset rolls back business data, sessions and history and releases its lock", async () => {
  const visitor = await login();
  const client = await pool.connect();
  try {
    await assert.rejects(() => resetDemoDatabase({ client, clearStorage: false, env: {
      ...process.env, DEMO_DATABASE_NAME: "wrong_database",
    } }), /does not match/);
  } finally { client.release(); }
  assert.equal((await heartbeat(visitor)).status, 204);
  assert.deepEqual(await history(), migrationHistory);
});

test("reset deletes old file names but preserves the migration tracker", async () => {
  const directory = path.join(storageRoot, "user-avatars");
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, "old-test-avatar.png");
  await fs.writeFile(file, "test image");
  const visitor = await login();
  await pool.query("UPDATE app.demo_sessions SET last_seen_at = clock_timestamp() - INTERVAL '16 minutes'");
  assert.equal((await end(visitor)).body.data.reset, true);
  await assert.rejects(fs.stat(file), { code: "ENOENT" });
  assert.deepEqual(await history(), migrationHistory);
});

test("login does not return a token if session registration fails", async () => {
  await pool.query(`CREATE FUNCTION app.reject_test_session() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'intentional session registration failure'; END; $$;
    CREATE TRIGGER reject_test_session BEFORE INSERT ON app.demo_sessions
    FOR EACH ROW EXECUTE FUNCTION app.reject_test_session();`);
  try {
    const response = await login();
    assert.equal(response.status, 500);
    assert.equal(response.body.data?.access_token, undefined);
    assert.equal(await sessionCount(), 0);
  } finally {
    await pool.query("DROP TRIGGER reject_test_session ON app.demo_sessions; DROP FUNCTION app.reject_test_session()");
  }
  assert.equal((await login()).status, 200);
});

test("failure during seeding rolls back TRUNCATE and retains the visitor's work", async () => {
  const visitor = await login();
  await pool.query("UPDATE app.products SET product_name = 'work before failure'");
  await pool.query(`CREATE FUNCTION app.reject_test_seed() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'intentional seed failure'; END; $$;
    CREATE TRIGGER reject_test_seed BEFORE INSERT ON app.users
    FOR EACH ROW EXECUTE FUNCTION app.reject_test_seed();`);
  const client = await pool.connect();
  try {
    await assert.rejects(() => resetDemoDatabase({ client, clearStorage: false }), /intentional seed failure/);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM app.products WHERE product_name = 'work before failure'")).rows[0].n, 5);
    assert.equal((await heartbeat(visitor)).status, 204);
    assert.deepEqual(await history(), migrationHistory);
  } finally {
    client.release();
    await pool.query("DROP TRIGGER reject_test_seed ON app.users; DROP FUNCTION app.reject_test_seed()");
  }
});
