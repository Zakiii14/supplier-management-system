import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import useAuth from "../hooks/useAuth";

const ProtectedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="session-loading">
        <div
          className="session-loading-spinner"
          aria-hidden="true"
        />

        <p>Memeriksa sesi pengguna...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;