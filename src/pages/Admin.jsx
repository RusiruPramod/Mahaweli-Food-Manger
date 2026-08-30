import { useEffect, useState, useCallback } from "react";
import {
  collection,
  onSnapshot,
  query,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { getToday } from "../utils/today";
import { formatPrice } from "../utils/price";
import Navbar from "../components/Navbar";
import AdminOrderList from "../components/AdminOrderList";
import AdminShoppingSummary from "../components/AdminShoppingSummary";
import AdminFoodNotepad from "../components/AdminFoodNotepad";
import AdminOrderHistory from "../components/AdminOrderHistory";
import AdminMenuEditor from "../components/AdminMenuEditor";
import AdminSessionManager from "../components/AdminSessionManager";
import { useActiveSession } from "../hooks/useActiveSession";
import {
  ClipboardList,
  Store,
  History,
  Settings,
  Calendar,
  Users,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Calculator,
} from "../components/Icons";

// Session icon mapping
const SESSION_ICONS = { morning: "☀️", lunch: "🍽️", dinner: "🌙", extra: "⭐" };

const TABS = [
  { id: "sessions", label: "Sessions",         icon: Calendar },
  { id: "orders",   label: "Today's Orders",   icon: ClipboardList },
  { id: "summary",  label: "Shopping Summary",  icon: Store },
  { id: "notepad",  label: "Food Notepad",     icon: Calculator },
  { id: "history",  label: "Order History",    icon: History },
  { id: "menu",     label: "Manage Menu",      icon: Settings },
];

export default function Admin() {
  const today = getToday();
  const [activeTab, setActiveTab] = useState("sessions");

  // ── Sessions (real-time) ───────────────────────────────────────────────────
  const { sessions, activeSession, loading: sessionsLoading } = useActiveSession();

  // ── currentSessionId: tracks which session's orders to show ────────────────
  // Follows: active session > most recently closed session > null
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Auto-follow active session or latest closed session
  useEffect(() => {
    if (activeSession?.id) {
      setCurrentSessionId(activeSession.id);
      return;
    }
    if (sessions.length > 0) {
      if (!currentSessionId || !sessions.some((s) => s.id === currentSessionId)) {
        const latest = sessions[sessions.length - 1];
        setCurrentSessionId(latest.id);
      }
    } else {
      setCurrentSessionId(null);
    }
  }, [activeSession, sessions, currentSessionId]);

  // Subscribe to orders for currentSessionId
  useEffect(() => {
    if (!currentSessionId) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    const ordersRef = collection(db, "orders", currentSessionId, "userOrders");
    const unsub = onSnapshot(
      ordersRef,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
        setOrdersLoading(false);
      },
      (err) => {
        console.error("Admin orders snapshot error:", err);
        setOrdersLoading(false);
      }
    );
    return unsub;
  }, [currentSessionId]);

  // Called by AdminSessionManager on open / reset
  const handleSessionChange = useCallback((newSessionId) => {
    setCurrentSessionId(newSessionId);
  }, []);

  // ── All Users (real-time) ───────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setAllUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
        setUsersLoading(false);
      },
      () => setUsersLoading(false)
    );
    return unsub;
  }, []);

  // ── Shops + items (real-time) ───────────────────────────────────────────────
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "shops")),
      async (snap) => {
        try {
          const shopDocs = snap.docs.map((d) => ({ id: d.id, ...d.data(), items: [] }));
          const loaded = await Promise.all(
            shopDocs.map(async (shop) => {
              const itemsSnap = await getDocs(collection(db, "shops", shop.id, "items"));
              shop.items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
              return shop;
            })
          );
          loaded.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setShops(loaded);
          setShopsLoading(false);
        } catch (err) {
          console.error("Admin shops load error:", err);
          setShopsLoading(false);
        }
      },
      () => setShopsLoading(false)
    );
    return unsub;
  }, []);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const activeGrandTotal = orders.reduce((s, o) => s + (o.total || 0), 0);
  const activeItemCount  = orders.reduce((s, o) => s + (o.items || []).reduce((ss, it) => ss + (it.qty || 0), 0), 0);

  // ── Done & Reset for Next Session Modal State ──────────────────────────────
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [completing, setCompleting]       = useState(false);
  const [globalFeedback, setGlobalFeedback] = useState("");

  const handleCompleteAndNextSession = async () => {
    if (!currentSessionId) return;
    const session = sessions.find((s) => s.id === currentSessionId);
    setCompleting(true);
    setGlobalFeedback("");

    try {
      // 1. Save to order_history
      if (orders.length > 0) {
        await addDoc(collection(db, "order_history"), {
          date: session?.date || today,
          sessionName: `${session?.label || "Session"} – ${session?.date || today}`,
          sessionType: session?.type || "custom",
          sessionId: currentSessionId,
          orders,
          totalAmount: activeGrandTotal,
          createdAt: serverTimestamp(),
        });
      }

      // 2. Mark session as closed
      if (session) {
        await updateDoc(doc(db, "sessions", currentSessionId), { status: "closed" });
      }

      // 3. Delete live orders for this session (clear board & reset counts)
      const ordersRef = collection(db, "orders", currentSessionId, "userOrders");
      const snap = await getDocs(ordersRef);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // 4. Reset current session and switch to Sessions tab
      setCurrentSessionId(null);
      setShowDoneModal(false);
      setActiveTab("sessions");

      setGlobalFeedback(`✅ ${session?.label || "Session"} orders archived to History & reset! Ready to start the next session.`);
      setTimeout(() => setGlobalFeedback(""), 7000);
    } catch (err) {
      console.error("Error completing session:", err);
      alert("Failed to complete session: " + err.message);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-16">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-gray-900">Admin Panel</h1>
              <span className="bg-brand-50 text-brand-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-brand-100">
                Live Manager
              </span>
              {/* Active session pill */}
              {activeSession && (
                <span className="flex items-center gap-1 bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-green-200">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                  {SESSION_ICONS[activeSession.type]} {activeSession.label} Open
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 font-medium flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {today}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                {orders.length} orders
              </span>
              {activeItemCount > 0 && (
                <>
                  <span>•</span>
                  <span>{activeItemCount} items · <strong className="text-brand-600">{formatPrice(activeGrandTotal)}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {globalFeedback && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl px-4 py-3 flex items-center gap-2 shadow-xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{globalFeedback}</span>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-1.5 bg-gray-200/80 p-1.5 rounded-2xl mb-6 overflow-x-auto shadow-inner">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 min-w-max flex items-center justify-center gap-1.5
                  px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200
                  ${activeTab === tab.id
                    ? "bg-white text-gray-900 shadow-sm shadow-black/5"
                    : "text-gray-500 hover:text-gray-800"
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${activeTab === tab.id ? "text-brand-600" : "text-gray-400"}`} />
                <span>{tab.label}</span>
                {tab.id === "orders" && orders.length > 0 && (
                  <span className="bg-brand-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">
                    {orders.length}
                  </span>
                )}
                {tab.id === "sessions" && activeSession && (
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────────── */}

        {activeTab === "sessions" && (
          <AdminSessionManager
            sessions={sessions}
            activeSession={activeSession}
            currentSessionId={currentSessionId}
            orders={orders}
            onSessionChange={handleSessionChange}
          />
        )}

        {activeTab === "orders" && (() => {
          const currentSession = sessions.find((s) => s.id === currentSessionId);
          return (
            <div className="space-y-4">
              {/* Session Switcher Pills if multiple sessions exist today */}
              {sessions.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs text-gray-400 font-bold shrink-0">Sessions:</span>
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setCurrentSessionId(s.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                        currentSessionId === s.id
                          ? "bg-brand-600 text-white shadow-xs"
                          : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{SESSION_ICONS[s.type]}</span>
                      <span>{s.label}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        s.status === "active" ? "bg-green-400 text-black animate-pulse" : "bg-gray-200 text-gray-600"
                      }`}>
                        {s.status === "active" ? "Live" : "Closed"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Session context & Done / Reset Action Bar */}
              {currentSession ? (
                <div className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs
                  ${currentSession.status === "active"
                    ? "bg-green-50/70 border-green-200"
                    : "bg-amber-50/70 border-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{SESSION_ICONS[currentSession.type]}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-gray-900">
                          {currentSession.label} Session Orders
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          currentSession.status === "active" ? "bg-green-500 text-white animate-pulse" : "bg-gray-200 text-gray-700"
                        }`}>
                          {currentSession.status === "active" ? "Live" : "Closed"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {orders.length} orders placed · {activeItemCount} items · <strong className="text-brand-700">{formatPrice(activeGrandTotal)}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Complete & Reset Button right in Today's Orders */}
                  {orders.length > 0 && (
                    <button
                      onClick={() => setShowDoneModal(true)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-600/30 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Orders Done — Save & Next Session</span>
                    </button>
                  )}
                </div>
              ) : (
                !sessionsLoading && (
                  <div className="bg-gray-50 border border-gray-200 text-gray-600 text-xs font-semibold rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span>⚠️</span>
                      <span>No session is open. Open a session from the Sessions tab.</span>
                    </span>
                    <button
                      onClick={() => setActiveTab("sessions")}
                      className="px-3 py-1.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 text-xs"
                    >
                      Go to Sessions
                    </button>
                  </div>
                )
              )}

              <AdminOrderList
                orders={orders}
                allUsers={allUsers}
                loading={ordersLoading || usersLoading}
              />
            </div>
          );
        })()}

        {activeTab === "summary" && (() => {
          const currentSession = sessions.find((s) => s.id === currentSessionId);
          return (
            <div className="space-y-4">
              {/* Session Switcher Pills if multiple sessions exist today */}
              {sessions.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs text-gray-400 font-bold shrink-0">Sessions:</span>
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setCurrentSessionId(s.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                        currentSessionId === s.id
                          ? "bg-brand-600 text-white shadow-xs"
                          : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{SESSION_ICONS[s.type]}</span>
                      <span>{s.label}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        s.status === "active" ? "bg-green-400 text-black animate-pulse" : "bg-gray-200 text-gray-600"
                      }`}>
                        {s.status === "active" ? "Live" : "Closed"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {currentSession && (
                <div className={`flex items-center gap-2 text-xs font-semibold rounded-2xl px-4 py-2.5
                  ${currentSession.status === "active"
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-amber-50 border border-amber-200 text-amber-800"
                  }`}>
                  <span>{SESSION_ICONS[currentSession.type]}</span>
                  <span>Shopping list for <strong>{currentSession.label} Session</strong>
                    {currentSession.status === "closed" ? " (session closed)" : ""}
                  </span>
                </div>
              )}
            <AdminShoppingSummary
              orders={orders}
              shops={shops.filter((s) => s.active !== false)}
              loading={ordersLoading || shopsLoading}
            />
          </div>
          );
        })()}

        {activeTab === "notepad" && (
          <AdminFoodNotepad shops={shops} loading={shopsLoading} />
        )}

        {activeTab === "history" && <AdminOrderHistory />}

        {activeTab === "menu" && (
          <AdminMenuEditor shops={shops} loading={shopsLoading} />
        )}

      </main>

      {/* ── Complete Orders & Reset Next Session Modal ────────────────────── */}
      {showDoneModal && (() => {
        const currentSession = sessions.find((s) => s.id === currentSessionId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center text-2xl font-bold border border-brand-100">
                  {currentSession ? SESSION_ICONS[currentSession.type] : "📦"}
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg">
                    Done with {currentSession?.label || "Current"} Orders?
                  </h3>
                  <p className="text-xs text-gray-500">
                    Save to history & reset live board for next session
                  </p>
                </div>
              </div>

              <div className="bg-brand-50/70 border border-brand-200/80 rounded-2xl p-4 text-xs text-brand-950 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-brand-900">
                  <CheckCircle className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>Summary of what happens:</span>
                </p>
                <ul className="list-disc pl-5 space-y-1 text-brand-900/80 font-medium">
                  <li>
                    <strong>{orders.length} orders</strong> ({formatPrice(activeGrandTotal)}) will be <strong>saved permanently into Order History</strong>.
                  </li>
                  <li>
                    Live orders board will be <strong>cleared (reset to 0)</strong>.
                  </li>
                  <li>
                    You will be moved to the <strong>Sessions tab</strong> to open the next session (Lunch, Dinner, etc.).
                  </li>
                </ul>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDoneModal(false)}
                  disabled={completing}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCompleteAndNextSession}
                  disabled={completing}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm shadow-brand-600/30 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {completing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Save History & Next Session</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
