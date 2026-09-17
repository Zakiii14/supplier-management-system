import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

// Node has no Vite build-time env. Substitute only that flag, leaving the
// production storage and tab-claim code intact.
const load = async (demo, t, locks) => {
  const local = storage();
  const session = storage();
  for (const [key, value] of Object.entries({ localStorage: local, sessionStorage: session, navigator: { locks } })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
  const source = (await readFile(new URL("../src/auth/sessionStorage.js", import.meta.url), "utf8"))
    .replace('import.meta.env?.VITE_DEMO_MODE === "true"', String(demo));
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${crypto.randomUUID()}`);
  return { local, session, module };
};

test("full-access login retains local storage and does not claim demo identity", async (t) => {
  const { local, session, module } = await load(false, t);
  local.setItem("access_token", "full-access-token");
  session.setItem("access_token", "demo-token");
  await module.claimDemoTab();
  assert.equal(module.getAccessToken(), "full-access-token");
  assert.equal(session.getItem(module.DEMO_CLIENT_ID_KEY), null);
});

test("normal demo tab retains its persisted inactivity deadline and ignores local login", async (t) => {
  const locks = { request: async (_, options, callback) => { assert.equal(options.ifAvailable, true); return callback({}); } };
  const { local, session, module } = await load(true, t, locks);
  local.setItem("access_token", "full-access-token");
  session.setItem("access_token", "demo-token");
  session.setItem(module.DEMO_ACTIVITY_KEY, "12345");
  const id = module.getDemoClientId();
  await module.claimDemoTab();
  assert.equal(module.getDemoClientId(), id);
  assert.equal(module.getAccessToken(), "demo-token");
  assert.equal(module.getLastActivity(), 12345);
});

test("duplicated demo tab cannot restore or end the original tab's copied login", async (t) => {
  let claims = 0;
  const locks = { request: async (_, __, callback) => callback(++claims === 1 ? null : {}) };
  const { local, session, module } = await load(true, t, locks);
  local.setItem("access_token", "full-access-token");
  session.setItem("access_token", "copied-demo-token");
  session.setItem("auth_user", "copied-user");
  const oldId = module.getDemoClientId();
  await module.claimDemoTab();
  assert.notEqual(module.getDemoClientId(), oldId);
  assert.equal(module.getAccessToken(), "");
  assert.equal(session.getItem("auth_user"), null);
  assert.equal(local.getItem("access_token"), "full-access-token");
});

test("browser without tab locks requires a fresh demo login without deleting local login", async (t) => {
  const { local, session, module } = await load(true, t);
  local.setItem("access_token", "full-access-token");
  session.setItem("access_token", "possibly-copied-token");
  await module.claimDemoTab();
  assert.equal(module.getAccessToken(), "");
  assert.equal(local.getItem("access_token"), "full-access-token");
});
