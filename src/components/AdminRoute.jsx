import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps any route that requires admin privileges.
 * Redirects to / if the user is not an admin.
 * Shows a loading spinner while profile is resolving.
 */
export default function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth();

  const isSystemAdmin = profile?.isAdmin || user?.email === "admin@gmail.com";

  if (loading || (user && profile === null && user.email !== "admin@gmail.com")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isSystemAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
