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

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    setUser(null);
  }, []);

  const login = useCallback(async (identifier, password) => {
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

    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

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
