import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getCurrentUserRequest,
  loginRequest,
} from "../api/auth";
import {
  endDemoSessionRequest,
  heartbeatDemoSessionRequest,
  prepareDemoSessionRequest,
} from "../api/demoSession";

const AuthContext = createContext(null);

const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_IDLE_MS = 15 * 60 * 1000;
const DEMO_HEARTBEAT_MS = 60 * 1000;
const DEMO_IDLE_CHECK_MS = 15 * 1000;
const DEMO_CLIENT_ID_KEY = "supplyflow_demo_client_id";

const createDemoClientId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const getDemoClientId = () => {
  let clientId = sessionStorage.getItem(DEMO_CLIENT_ID_KEY);
  if (!clientId) {
    clientId = createDemoClientId();
    sessionStorage.setItem(DEMO_CLIENT_ID_KEY, clientId);
  }
  return clientId;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    setUser(null);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const demoClientId = IS_DEMO_MODE
      ? getDemoClientId()
      : "";

    if (IS_DEMO_MODE) {
      await prepareDemoSessionRequest();
    }

    const data = await loginRequest({
      identifier,
      password,
    });

    localStorage.setItem(
      "access_token",
      data.access_token,
    );
    localStorage.setItem(
      "auth_user",
      JSON.stringify(data.user),
    );

    setUser(data.user);

    if (IS_DEMO_MODE) {
      heartbeatDemoSessionRequest(demoClientId).catch(() => {});
    }

    return data.user;
  }, []);

  const logout = useCallback(() => {
    if (IS_DEMO_MODE && user) {
      const accessToken =
        localStorage.getItem("access_token") || "";
      endDemoSessionRequest(
        getDemoClientId(),
        accessToken,
      ).catch(() => {});
    }

    clearSession();
  }, [clearSession, user]);

  const refreshUser = useCallback(async () => {
    const currentUser = await getCurrentUserRequest();
    setUser(currentUser);
    localStorage.setItem("auth_user", JSON.stringify(currentUser));
    return currentUser;
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      const accessToken =
        localStorage.getItem("access_token");

      if (!accessToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser =
          await getCurrentUserRequest();

        if (!isCancelled) {
          setUser(currentUser);
          localStorage.setItem(
            "auth_user",
            JSON.stringify(currentUser),
          );
        }
      } catch {
        if (!isCancelled) {
          clearSession();
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [clearSession]);

  useEffect(() => {
    if (!IS_DEMO_MODE || !user) {
      return undefined;
    }

    const clientId = getDemoClientId();
    let lastActivityAt = Date.now();
    let hasEnded = false;

    const endIdleSession = () => {
      if (hasEnded) return;
      hasEnded = true;

      const accessToken =
        localStorage.getItem("access_token") || "";

      endDemoSessionRequest(clientId, accessToken).catch(() => {});
      clearSession();
    };

    const isStillActive = () => {
      if (Date.now() - lastActivityAt >= DEMO_IDLE_MS) {
        endIdleSession();
        return false;
      }
      return true;
    };

    const markActivity = () => {
      if (!hasEnded && document.visibilityState === "visible") {
        lastActivityAt = Date.now();
      }
    };

    const sendHeartbeat = () => {
      if (
        hasEnded ||
        document.visibilityState !== "visible" ||
        !isStillActive()
      ) {
        return;
      }

      heartbeatDemoSessionRequest(clientId).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!isStillActive()) return;
      lastActivityAt = Date.now();
      sendHeartbeat();
    };

    const activityEvents = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, {
        passive: true,
      });
    });
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    sendHeartbeat();

    const heartbeatTimer = window.setInterval(
      sendHeartbeat,
      DEMO_HEARTBEAT_MS,
    );
    const idleTimer = window.setInterval(
      isStillActive,
      DEMO_IDLE_CHECK_MS,
    );

    return () => {
      window.clearInterval(heartbeatTimer);
      window.clearInterval(idleTimer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [clearSession, user]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
