// Kept independent of React so sleep/resume, idle boundaries and delayed
// heartbeat responses can be tested with a controlled clock.
export const createDemoSessionMonitor = ({
  readActivity, writeActivity, idleMs, isVisible, heartbeat, onEnd,
  now = Date.now,
}) => {
  let stopped = false;
  let pending = false;
  const end = () => {
    if (stopped) return;
    stopped = true;
    onEnd();
  };
  const check = () => {
    if (stopped) return false;
    if (now() - readActivity() >= idleMs) {
      end();
      return false;
    }
    return true;
  };
  const activity = () => {
    // An input after a suspended tab resumes must not revive an expired session.
    if (check() && isVisible()) writeActivity(now());
  };
  const beat = async () => {
    if (!check() || !isVisible() || pending) return;
    pending = true;
    try {
      await heartbeat();
    } catch (error) {
      if (error.response?.status === 401) end();
      // Temporary transport/server errors are retried on the next heartbeat.
    } finally {
      pending = false;
    }
  };
  return { check, activity, beat, stop: () => { stopped = true; } };
};
