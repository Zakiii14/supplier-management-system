import {
  createContext, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { getCurrentUserRequest, loginRequest } from "../api/auth";
import {
  endDemoSessionRequest, heartbeatDemoSessionRequest, prepareDemoSessionRequest,
} from "../api/demoSession";
import {
  IS_DEMO_MODE, DEMO_ACTIVITY_KEY, DEMO_IDLE_KEY,
  claimDemoTab, getAccessToken, getAuthStorage, getDemoClientId,
  getDemoIdleMs, getLastActivity, markDemoActivity,
} from "../auth/sessionStorage";
import { createDemoSessionMonitor } from "../auth/demoSessionMonitor";

const AuthContext = createContext(null);
const DEMO_HEARTBEAT_MS = 60 * 1000;
const DEMO_IDLE_CHECK_MS = 15 * 1000;

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const generation = useRef(0);

  const clearSession = useCallback(() => {
    generation.current += 1;
    getAuthStorage().removeItem("access_token");
    getAuthStorage().removeItem("auth_user");
    if (IS_DEMO_MODE) sessionStorage.removeItem(DEMO_ACTIVITY_KEY);
    setUser(null);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const attempt = ++generation.current;
    if (IS_DEMO_MODE) {
      await claimDemoTab();
      await prepareDemoSessionRequest();
    }
    const clientId = IS_DEMO_MODE ? getDemoClientId() : undefined;
    const data = await loginRequest({ identifier, password, client_id: clientId });
    if (attempt !== generation.current) {
      if (IS_DEMO_MODE) endDemoSessionRequest(clientId, data.access_token).catch(() => {});
      throw new Error("Login dibatalkan. Silakan coba lagi.");
    }
    getAuthStorage().setItem("access_token", data.access_token);
    getAuthStorage().setItem("auth_user", JSON.stringify(data.user));
    if (IS_DEMO_MODE) {
      sessionStorage.setItem(DEMO_IDLE_KEY, String(data.demo_idle_minutes * 60 * 1000));
      markDemoActivity();
    }
    // Backend has already committed the session before returning this token.
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    const token = getAccessToken();
    if (IS_DEMO_MODE && token) {
      endDemoSessionRequest(getDemoClientId(), token).catch(() => {});
    }
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    const currentUser = await getCurrentUserRequest();
    if (getAccessToken() === token) {
      setUser(currentUser);
      getAuthStorage().setItem("auth_user", JSON.stringify(currentUser));
    }
    return currentUser;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const attempt = generation.current;
    const restoreSession = async () => {
      try {
        if (IS_DEMO_MODE) await claimDemoTab();
        if (cancelled || attempt !== generation.current) return;
        const token = getAccessToken();
        if (!token) return;
        if (IS_DEMO_MODE && Date.now() - getLastActivity() >= getDemoIdleMs()) {
          logout();
          return;
        }
        const currentUser = await getCurrentUserRequest();
        if (!cancelled && attempt === generation.current && getAccessToken() === token) {
          setUser(currentUser);
          getAuthStorage().setItem("auth_user", JSON.stringify(currentUser));
        }
      } catch {
        if (!cancelled && attempt === generation.current) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    restoreSession();
    return () => { cancelled = true; };
  }, [clearSession, logout]);

  // Profile refreshes must not restart the idle clock or heartbeat lifecycle.
  const userId = user?.id;
  const sessionToken = user ? getAccessToken() : "";
  useEffect(() => {
    if (!IS_DEMO_MODE || !userId) return undefined;
    const clientId = getDemoClientId();
    const token = sessionToken;
    const monitor = createDemoSessionMonitor({
      readActivity: getLastActivity,
      writeActivity: (at) => sessionStorage.setItem(DEMO_ACTIVITY_KEY, String(at)),
      idleMs: getDemoIdleMs(),
      isVisible: () => document.visibilityState === "visible",
      heartbeat: () => heartbeatDemoSessionRequest(clientId, token),
      onEnd: () => {
        if (getAccessToken() !== token) return;
        endDemoSessionRequest(clientId, token).catch(() => {});
        clearSession();
      },
    });
    const events = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "scroll"];
    events.forEach((name) => window.addEventListener(name, monitor.activity, {
      passive: true, capture: true,
    }));
    const onVisibility = () => { monitor.beat(); };
    document.addEventListener("visibilitychange", onVisibility);
    monitor.beat();
    const heartbeatTimer = window.setInterval(monitor.beat, DEMO_HEARTBEAT_MS);
    const idleTimer = window.setInterval(monitor.check, DEMO_IDLE_CHECK_MS);
    return () => {
      monitor.stop();
      window.clearInterval(heartbeatTimer);
      window.clearInterval(idleTimer);
      events.forEach((name) => window.removeEventListener(name, monitor.activity, true));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [clearSession, userId, sessionToken]);

  const value = useMemo(() => ({
    user, isAuthenticated: Boolean(user), isLoading, login, logout, refreshUser,
  }), [user, isLoading, login, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthContext, AuthProvider };
