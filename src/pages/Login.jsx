import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function normalize(raw) {
    return raw.toLowerCase().trim().replace(/\s+/g, "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const usernameLower = normalize(name);

      // Look up the synthetic email from the username doc
      const usernameRef = doc(db, "usernames", usernameLower);
      const usernameSnap = await getDoc(usernameRef);

      if (!usernameSnap.exists()) {
        setError("Name not found. Check your spelling or sign up first.");
        setLoading(false);
        return;
      }

      const { email } = usernameSnap.data();

      // Sign in with the synthetic email
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential" ||
        err.code === "auth/invalid-email"
      ) {
        setError("Wrong password. Please try again.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please wait a moment and try again.");
      } else {
        setError(err.message ?? "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍱</div>
          <h1 className="text-2xl font-extrabold text-gray-900">Mahaweli Foods</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back! Log in to order.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 border border-gray-100 p-7">
          <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="login-name">
                Your Name
              </label>
              <input
                id="login-name"
                type="text"
                autoComplete="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kasun"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                  focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                  transition-shadow"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                  focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                  transition-shadow"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-xl
                hover:bg-brand-600 active:scale-[0.98] transition-all duration-150
                disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-brand-200
                flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging in…
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            New here?{" "}
            <Link to="/signup" className="text-brand-600 font-semibold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
