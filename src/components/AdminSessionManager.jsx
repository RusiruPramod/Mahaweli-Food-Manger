import { useState } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  writeBatch,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { getToday } from "../utils/today";
import { formatPrice } from "../utils/price";
import { RefreshCw, CheckCircle, AlertTriangle, Trash2 } from "./Icons";

const SESSION_TYPES = [
  { type: "morning", label: "Morning", gradient: "from-amber-400 to-orange-400", bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  icon: "☀️" },
  { type: "lunch",   label: "Lunch",   gradient: "from-green-400 to-emerald-400",bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800",  icon: "🍽️" },
  { type: "dinner",  label: "Dinner",  gradient: "from-indigo-400 to-purple-400",bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800", icon: "🌙" },
  { type: "extra",   label: "Extra",   gradient: "from-rose-400 to-pink-400",    bg: "bg-rose-50",   border: "border-rose-200",   text: "text-rose-800",   icon: "⭐" },
];

/**
 * AdminSessionManager
 *
 * TWO-STEP flow:
 *
 * STEP 1 — "Close & Archive Current Session"
 *   → Session status set to "closed" (users can no longer order)
 *   → Orders are NOT deleted — they remain visible in "Today's Orders" tab
 *   → Session is saved to order_history
 *
 * STEP 2 — "Reset (Clear for Next Session)"
 *   → Deletes all order docs for the closed session
 *   → Admin can now open a new session (Morning/Lunch/Dinner/Extra)
 */
export default function AdminSessionManager({
  sessions = [],
  activeSession = null,
  currentSessionId = null,   // the session whose orders are being shown
  orders = [],
  onSessionChange,
}) {
  const today = getToday();
  const [creating, setCreating]       = useState(null);
  const [working, setWorking]         = useState(false);
  const [unlocking, setUnlocking]     = useState(null); // sessionId being unlocked
  const [feedback, setFeedback]       = useState({ msg: "", type: "ok" });

  const showMsg = (msg, type = "ok") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback({ msg: "", type: "ok" }), 6000);
  };

  // ── OPEN SESSION ────────────────────────────────────────────────────────────
  const handleOpenSession = async (typeObj) => {
    if (activeSession) {
      showMsg(`Close the "${activeSession.label}" session first before opening a new one.`, "warn");
      return;
    }

    // Check if there are still orders from a previous closed session (must reset first)
    const lastClosed = sessions.filter((s) => s.status === "closed").slice(-1)[0];
    if (lastClosed) {
      const snap = await getDocs(collection(db, "orders", lastClosed.id, "userOrders"));
      if (!snap.empty) {
        showMsg(`Reset the "${lastClosed.label}" session orders first before opening a new session.`, "warn");
        return;
      }
    }

    const sessionId = `${today}_${typeObj.type}`;
    setCreating(typeObj.type);
    try {
      await setDoc(doc(db, "sessions", sessionId), {
        date: today,
        type: typeObj.type,
        label: typeObj.label,
        icon: typeObj.icon,
        status: "active",
        createdAt: serverTimestamp(),
      });
      onSessionChange?.(sessionId);
      showMsg(`✅ ${typeObj.label} session is now OPEN. Members can place orders.`);
    } catch (err) {
      console.error("Error opening session:", err);
      showMsg("❌ Failed to open session: " + err.message, "err");
    } finally {
      setCreating(null);
    }
  };

  // ── CLOSE CURRENT SESSION (Stop ordering) ──────────────────────────────────
  // Only marks status = "closed". Orders remain 100% intact for Today's Orders.
  const handleCloseSession = async () => {
    if (!activeSession) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, "sessions", activeSession.id), { status: "closed" });
      showMsg(`🔒 ${activeSession.label} session closed. You can now view and deliver orders in "Today's Orders".`);
    } catch (err) {
      console.error("Error closing session:", err);
      showMsg("❌ Failed to close session: " + err.message, "err");
    } finally {
      setWorking(false);
    }
  };

  // ── UNLOCK: re-open a closed session ─────────────────────────────────────────
  const handleUnlock = async (session) => {
    if (activeSession) {
      showMsg(`Close the active "${activeSession.label}" session first before unlocking another.`, "warn");
      return;
    }
    setUnlocking(session.id);
    try {
      await updateDoc(doc(db, "sessions", session.id), { status: "active" });
      onSessionChange?.(session.id);
      showMsg(`✅ ${session.label} session unlocked! Members can place orders again.`);
    } catch (err) {
      console.error("Error unlocking session:", err);
      showMsg("❌ Failed to unlock session: " + err.message, "err");
    } finally {
      setUnlocking(null);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const closedSessions = sessions.filter((s) => s.status === "closed");
  const lastClosed     = closedSessions.slice(-1)[0] ?? null;

  return (
    <div className="space-y-5">

      {/* ── Feedback ──────────────────────────────────────────────────────── */}
      {feedback.msg && (
        <div className={`text-xs font-semibold rounded-2xl px-4 py-3 flex items-center gap-2 border
          ${feedback.type === "err"  ? "bg-red-50 border-red-200 text-red-800"
          : feedback.type === "warn" ? "bg-amber-50 border-amber-200 text-amber-800"
          :                            "bg-emerald-50 border-emerald-200 text-emerald-800"}`}
        >
          {feedback.type === "ok"
            ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            : <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* ── ACTIVE SESSION CARD ────────────────────────────────────────────── */}
      {activeSession && (() => {
        const t = SESSION_TYPES.find((s) => s.type === activeSession.type);
        const total = orders.reduce((s, o) => s + (o.total || 0), 0);
        return (
          <div className={`rounded-3xl border ${t?.border} ${t?.bg} p-5`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Session info */}
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeSession.icon}</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-extrabold text-base ${t?.text}`}>
                      {activeSession.label} Session
                    </span>
                    <span className="text-[10px] font-bold uppercase bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">
                    {orders.length} orders
                    {total > 0 ? ` · ${formatPrice(total)}` : " · No orders yet"}
                    {" · Members can order now"}
                  </p>
                </div>
              </div>

              {/* Close session button */}
              <button
                onClick={handleCloseSession}
                disabled={working}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all active:scale-95 shadow-sm whitespace-nowrap"
              >
                {working
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <span>🔒</span>}
                Close Session (Stop Ordering)
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── CLOSED SESSION BANNER ──────────────────────────────────────────── */}
      {!activeSession && lastClosed && (
        <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl opacity-70">{lastClosed.icon}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-gray-800">{lastClosed.label} Session</span>
                <span className="text-[10px] font-bold uppercase bg-gray-400 text-white px-2 py-0.5 rounded-full">
                  CLOSED
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Orders are preserved and visible in <strong>Today's Orders</strong>. Use <strong>"Orders Done"</strong> there when food delivery is complete.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── NO SESSION ────────────────────────────────────────────────────── */}
      {!activeSession && !lastClosed && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-5 text-center">
          <p className="text-gray-400 text-sm font-medium">No session open today.</p>
          <p className="text-gray-400 text-xs mt-1">Open a session below — members will see it instantly.</p>
        </div>
      )}

      {/* ── OPEN / UNLOCK SESSION BUTTONS ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {activeSession ? "Session Status" : "Open / Unlock a Session"}
          </p>
          {!activeSession && closedSessions.length > 0 && (
            <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              💡 Click any closed session to Unlock
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SESSION_TYPES.map((t) => {
            const sessionForType = sessions.find((s) => s.type === t.type);
            const isClosed   = sessionForType?.status === "closed";
            const isActive   = sessionForType?.status === "active";
            const isCreating = creating === t.type;
            const isUnlocking = unlocking === sessionForType?.id;

            // Can unlock if closed and no active session
            const canUnlock = isClosed && !activeSession;
            const disabled = isCreating || (activeSession && !isActive);

            const handleClick = () => {
              if (isActive) return;
              if (canUnlock && sessionForType) {
                handleUnlock(sessionForType);
              } else if (!isClosed && !activeSession) {
                handleOpenSession(t);
              }
            };

            return (
              <button
                key={t.type}
                onClick={handleClick}
                disabled={disabled}
                title={canUnlock ? `Click to unlock ${t.label} session` : ""}
                className={`
                  relative flex flex-col items-center justify-center gap-2 p-4 rounded-3xl border font-bold text-sm
                  transition-all duration-200 active:scale-95 select-none
                  ${isActive
                    ? `bg-gradient-to-br ${t.gradient} text-white border-transparent shadow-lg ring-2 ring-brand-400/40`
                    : canUnlock
                    ? `bg-white ${t.border} ${t.text} hover:${t.bg} hover:border-amber-400 hover:shadow-md cursor-pointer border-dashed`
                    : disabled
                    ? "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
                    : `bg-white ${t.border} ${t.text} hover:${t.bg} hover:shadow-md cursor-pointer shadow-sm`
                  }
                `}
              >
                {isActive && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                    Live
                  </span>
                )}
                {canUnlock && (
                  <span className="absolute top-2 right-2 text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    🔓 Unlock
                  </span>
                )}
                {isClosed && activeSession && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">
                    Done
                  </span>
                )}
                <span className="text-2xl">
                  {isCreating || isUnlocking ? (
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600" />
                  ) : (
                    t.icon
                  )}
                </span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TODAY'S SESSION LOG ────────────────────────────────────────────── */}
      {sessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Today's Session Log
            </p>
            {!activeSession && closedSessions.length > 0 && (
              <span className="text-[10px] text-gray-400 font-medium">
                Click Unlock to reopen any session
              </span>
            )}
          </div>
          <div className="space-y-2">
            {sessions.map((s) => {
              const t = SESSION_TYPES.find((st) => st.type === s.type);
              const isOpen      = s.status === "active";
              const isUnlocking = unlocking === s.id;

              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-xs font-semibold
                    ${isOpen ? `${t?.bg} ${t?.border} ${t?.text}` : "bg-gray-50 border-gray-200 text-gray-700"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{s.icon}</span>
                    <span className="font-bold">{s.label} Session</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isOpen ? "bg-green-500 text-white animate-pulse" : "bg-gray-200 text-gray-500"
                    }`}>
                      {isOpen ? "Live" : "Closed"}
                    </span>

                    {/* Unlock button — shown for closed session when no other session is active */}
                    {!isOpen && !activeSession && (
                      <button
                        onClick={() => handleUnlock(s)}
                        disabled={isUnlocking || !!unlocking}
                        className="flex items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-all active:scale-95 shadow-xs disabled:opacity-50"
                        title={`Unlock ${s.label} session for users to order again`}
                      >
                        {isUnlocking ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>🔓 Unlock</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
