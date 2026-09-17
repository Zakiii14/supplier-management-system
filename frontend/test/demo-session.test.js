import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoSessionMonitor } from "../src/auth/demoSessionMonitor.js";

const fixture = (overrides = {}) => {
  const state = { now: 1000, activity: 1000, visible: true, ends: 0, beats: 0 };
  const options = {
    readActivity: () => state.activity,
    writeActivity: (at) => { state.activity = at; },
    idleMs: 15 * 60 * 1000,
    isVisible: () => state.visible,
    now: () => state.now,
    heartbeat: async () => { state.beats += 1; },
    onEnd: () => { state.ends += 1; },
    ...overrides,
  };
  return { state, options, monitor: createDemoSessionMonitor(options) };
};

test("heartbeat does not extend activity; exact 15 minute boundary ends once", async () => {
  const { state, monitor } = fixture();
  for (let minute = 1; minute <= 15; minute += 1) {
    state.now = 1000 + minute * 60000;
    await monitor.beat();
  }
  assert.equal(state.beats, 14);
  assert.equal(state.ends, 1);
  monitor.activity();
  monitor.check();
  assert.equal(state.activity, 1000);
  assert.equal(state.ends, 1);
});

test("refresh/profile lifecycle preserves activity and expires at the original deadline", () => {
  const { state, options, monitor } = fixture();
  state.now += 14 * 60000;
  monitor.stop();
  const restored = createDemoSessionMonitor(options);
  assert.equal(restored.check(), true);
  state.now += 60000;
  assert.equal(restored.check(), false);
  assert.equal(state.ends, 1);
});

test("hidden tabs do not heartbeat or extend activity; input after sleep cannot revive", async () => {
  const { state, monitor } = fixture();
  state.visible = false;
  state.now += 60000;
  monitor.activity();
  await monitor.beat();
  assert.equal(state.beats, 0);
  assert.equal(state.activity, 1000);
  state.now += 15 * 60000;
  state.visible = true;
  monitor.activity();
  assert.equal(state.ends, 1);
  assert.equal(state.activity, 1000);
});

test("visible interaction extends idle deadline", () => {
  const { state, monitor } = fixture();
  state.now += 14 * 60000;
  monitor.activity();
  state.now += 14 * 60000;
  assert.equal(monitor.check(), true);
  assert.equal(state.ends, 0);
});

test("heartbeat is single-flight and late failure after cleanup does not log out a new login", async () => {
  let reject;
  const { state, monitor } = fixture({ heartbeat: () => new Promise((_, fail) => { reject = fail; }) });
  const pending = monitor.beat();
  await monitor.beat();
  monitor.stop();
  reject({ response: { status: 401 } });
  await pending;
  assert.equal(state.ends, 0);
});

test("expired server session clears login; temporary heartbeat failure can retry", async () => {
  let attempts = 0;
  const { state, monitor } = fixture({ heartbeat: async () => {
    attempts += 1;
    throw { response: { status: attempts === 1 ? 503 : 401 } };
  } });
  await monitor.beat();
  assert.equal(state.ends, 0);
  await monitor.beat();
  assert.equal(state.ends, 1);
});
