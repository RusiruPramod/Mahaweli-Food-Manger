import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function normalize(raw) {
    return raw.toLowerCase().trim().replace(/\s+/g, "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const usernameLower = normalize(name);
    const syntheticEmail = `${usernameLower}@hostelfoods.app`;

    setLoading(true);
    try {
      // 1. Check username availability (public read)
      const usernameRef = doc(db, "usernames", usernameLower);
      const usernameSnap = await getDoc(usernameRef);
      if (usernameSnap.exists()) {
        setError("That name is already taken. Try a different one.");
        setLoading(false);
        return;
      }

      // 2. Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(
        auth,
        syntheticEmail,
        password
      );
      const { uid } = credential.user;

      // 3. Write username lookup doc
      await setDoc(usernameRef, {
        uid,
        email: syntheticEmail,
        createdAt: serverTimestamp(),
      });

      // 4. Write user profile doc
      await setDoc(doc(db, "users", uid), {
        name: name.trim(),
        usernameLower,
        isAdmin: false,
        createdAt: serverTimestamp(),
      });

      navigate("/");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("That name is already registered. Try logging in instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else {
        setError(err.message ?? "Something went wrong. Please try again.");
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
          <p className="text-gray-500 text-sm mt-1">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-orange-100 border border-gray-100 p-7">
          <form id="signup-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="signup-name">
                Your Name
              </label>
              <input
                id="signup-name"
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="signup-password">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                  focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                  transition-shadow"
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="signup-confirm">
                Confirm Password
              </label>
              <input
                id="signup-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
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
              id="signup-submit"
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
                  Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-600 font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
