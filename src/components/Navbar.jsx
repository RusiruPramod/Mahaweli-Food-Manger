import { signOut } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Settings } from "./Icons";

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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-brand-500">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            <path d="M11 6H9a5 5 0 0 0-5 5h2a3 3 0 0 1 3-3h2V6zm2 0v2h2a3 3 0 0 1 3 3h2a5 5 0 0 0-5-5h-2z"/>
          </svg>
          <span className="hidden sm:inline">Mahaweli Foods</span>
          <span className="sm:hidden">Mahaweli</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {showAdminLink && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-xs font-semibold bg-brand-100 text-brand-700 px-3 py-1.5 rounded-full hover:bg-brand-200 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Admin
            </Link>
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
