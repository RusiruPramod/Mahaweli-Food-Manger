import { signOut } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  const showAdminLink = profile?.isAdmin || user?.email === "admin@gmail.com";

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo / App name */}
        <Link to="/" className="flex items-center gap-2 text-brand-600 font-bold text-lg leading-none">
          <span className="text-2xl">🍱</span>
          <span className="hidden sm:inline">Mahaweli Foods</span>
          <span className="sm:hidden">Mahaweli</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {showAdminLink && (
            <Link
              to="/admin"
              className="text-xs font-semibold bg-brand-100 text-brand-700 px-3 py-1 rounded-full hover:bg-brand-200 transition-colors"
            >
              Admin ⚙️
            </Link>
          )}

          {profile && (
            <span className="hidden sm:block text-sm text-gray-600 font-medium">
              {profile.name}
            </span>
          )}

          <button
            id="logout-btn"
            onClick={handleLogout}
            className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
