export const IS_DEMO_MODE = import.meta.env?.VITE_DEMO_MODE === "true";
export const DEMO_CLIENT_ID_KEY = "supplyflow_demo_client_id";
export const DEMO_ACTIVITY_KEY = "supplyflow_demo_last_activity";
export const DEMO_IDLE_KEY = "supplyflow_demo_idle_ms";

// Full-access/local installations retain their existing persistent login.
export const getAuthStorage = () => IS_DEMO_MODE ? sessionStorage : localStorage;
export const getAccessToken = () => getAuthStorage().getItem("access_token") || "";
export const getDemoClientId = () => {
  let id = sessionStorage.getItem(DEMO_CLIENT_ID_KEY);
  if (!id) {
    id = globalThis.crypto.randomUUID();
    sessionStorage.setItem(DEMO_CLIENT_ID_KEY, id);
  }
  return id;
};
export const getDemoIdleMs = () => Number(sessionStorage.getItem(DEMO_IDLE_KEY)) || 15 * 60 * 1000;
export const getLastActivity = () => Number(sessionStorage.getItem(DEMO_ACTIVITY_KEY)) || 0;
export const markDemoActivity = () => sessionStorage.setItem(DEMO_ACTIVITY_KEY, String(Date.now()));

let claimPromise;
// Duplicating/opening a tab can copy sessionStorage, including the session ID.
// A browser lock detects that copy before it can restore the other tab's login.
export const claimDemoTab = () => {
  if (!IS_DEMO_MODE) return Promise.resolve();
  if (claimPromise) return claimPromise;
  claimPromise = new Promise((resolve, reject) => {
    const claim = () => {
      const id = getDemoClientId();
      if (!navigator.locks) {
        // Without tab locks, require a fresh demo login on page load; never
        // reuse a potentially copied identity to end another tab's session.
        sessionStorage.setItem(DEMO_CLIENT_ID_KEY, crypto.randomUUID());
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("auth_user");
        resolve();
        return;
      }
      navigator.locks.request(`supplyflow-demo-${id}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          sessionStorage.setItem(DEMO_CLIENT_ID_KEY, crypto.randomUUID());
          sessionStorage.removeItem("access_token");
          sessionStorage.removeItem("auth_user");
          claim();
          return;
        }
        resolve();
        // The browser releases this lock automatically when the page closes.
        return new Promise(() => {});
      }).catch(reject);
    };
    claim();
  });
  return claimPromise;
};
