import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { getToday } from "../utils/today";
import { formatPrice } from "../utils/price";
import Navbar from "../components/Navbar";
import AdminOrderList from "../components/AdminOrderList";
import AdminShoppingSummary from "../components/AdminShoppingSummary";
import AdminOrderHistory from "../components/AdminOrderHistory";
import AdminMenuEditor from "../components/AdminMenuEditor";
import {
  ClipboardList,
  Store,
  History,
  Settings,
  RefreshCw,
  Calendar,
  CheckCircle,
  AlertTriangle,
} from "../components/Icons";

const TABS = [
  { id: "orders", label: "Today's Orders", icon: ClipboardList },
  { id: "summary", label: "Shopping Summary", icon: Store },
  { id: "history", label: "Order History", icon: History },
  { id: "menu", label: "Manage Menu", icon: Settings },
];

export default function Admin() {
  const today = getToday();
  const [activeTab, setActiveTab] = useState("orders");

  // ---------- Today's orders (real-time) ----------
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    const ordersRef = collection(db, "orders", today, "userOrders");
    const unsub = onSnapshot(
      ordersRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        setOrders(data);
        setOrdersLoading(false);
      },
      (err) => {
        console.error("Admin orders snapshot error:", err);
        setOrdersLoading(false);
      }
    );
    return unsub;
  }, [today]);

  // ---------- All Users (real-time) ----------
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    const usersRef = collection(db, "users");
    const unsub = onSnapshot(
      usersRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        setAllUsers(data);
        setUsersLoading(false);
      },
      (err) => {
        console.error("Admin users snapshot error:", err);
        setUsersLoading(false);
      }
    );
    return unsub;
  }, []);

  // ---------- Shops + items (real-time, all — including inactive) ----------
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);

  useEffect(() => {
    // Listen to ALL shops (not just active), for the menu editor
    const shopsQ = query(collection(db, "shops"));

    const unsub = onSnapshot(
      shopsQ,
      async (snap) => {
        try {
          const shopDocs = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            items: [],
          }));

          // For each shop fetch ALL items (including inactive) for the menu editor
          const shopPromises = shopDocs.map(async (shop) => {
            const itemsSnap = await getDocs(
              collection(db, "shops", shop.id, "items")
            );
            shop.items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            return shop;
          });

          const loaded = await Promise.all(shopPromises);
          // Sort client-side
          loaded.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setShops(loaded);
          setShopsLoading(false);
        } catch (err) {
          console.error("Admin shops load error:", err);
          setShopsLoading(false);
        }
      },
      (err) => {
        console.error("Admin shops subscription error:", err);
        setShopsLoading(false);
      }
    );

    return unsub;
  }, []);

  // ---------- Session Reset State & Modal ----------
  const [showResetModal, setShowResetModal] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState("");

  const activeGrandTotal = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const activeItemCount = orders.reduce(
    (sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.qty || 0), 0),
    0
  );

  const openResetModal = () => {
    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    setSessionName(`Food Session (${timeStr})`);
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    setResetFeedback("");

    try {
      // 1. If there are active orders, save them to order_history
      if (orders.length > 0) {
        await addDoc(collection(db, "order_history"), {
          date: today,
          sessionName: sessionName.trim() || `Session - ${today}`,
          orders: orders,
          totalAmount: activeGrandTotal,
          createdAt: serverTimestamp(),
        });
      }

      // 2. Batch delete all user orders for today to reset active ordering board
      const batch = writeBatch(db);
      const ordersRef = collection(db, "orders", today, "userOrders");
      const snap = await getDocs(ordersRef);

      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();

      setShowResetModal(false);
      setResetFeedback(
        `Session "${sessionName}" successfully archived & reset! A new ordering cycle is active.`
      );
      setTimeout(() => setResetFeedback(""), 6000);
    } catch (err) {
      console.error("Error resetting session:", err);
      alert("Failed to reset session: " + err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-16">
        {/* Page heading & Session Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-gray-900">Admin Panel</h1>
              <span className="bg-brand-50 text-brand-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-brand-100">
                Live Manager
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {today}
              </span>
              <span>•</span>
              <span>
                Active Orders:{" "}
                <strong className="text-gray-900">{orders.length}</strong> ({activeItemCount} items)
              </span>
              <span>•</span>
              <span>
                Live Total:{" "}
                <strong className="text-brand-600 font-bold">
                  {formatPrice(activeGrandTotal)}
                </strong>
              </span>
            </div>
          </div>

          {/* Quick Actions / Reset Session Button */}
          <div className="flex items-center gap-2">
            <button
              id="reset-session-btn"
              onClick={openResetModal}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 border border-amber-400"
            >
              <RefreshCw className="w-4 h-4 animate-spin-hover" />
              <span>Reset / New Session</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {resetFeedback && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl px-4 py-3 flex items-center gap-2 shadow-xs">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{resetFeedback}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 bg-gray-200/80 p-1.5 rounded-2xl mb-6 overflow-x-auto shadow-inner">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 min-w-max flex items-center justify-center gap-2
                  px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200
                  ${
                    activeTab === tab.id
                      ? "bg-white text-gray-900 shadow-sm shadow-black/5"
                      : "text-gray-500 hover:text-gray-800"
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${activeTab === tab.id ? "text-brand-600" : "text-gray-400"}`} />
                <span>{tab.label}</span>
                {tab.id === "orders" && orders.length > 0 && (
                  <span className="bg-brand-500 text-white text-[10px] px-2 py-0.2 rounded-full font-bold">
                    {orders.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "orders" && (
          <AdminOrderList
            orders={orders}
            allUsers={allUsers}
            loading={ordersLoading || usersLoading}
          />
        )}
        {activeTab === "summary" && (
          <AdminShoppingSummary
            orders={orders}
            shops={shops.filter((s) => s.active !== false)}
            loading={ordersLoading || shopsLoading}
          />
        )}
        {activeTab === "history" && <AdminOrderHistory />}
        {activeTab === "menu" && (
          <AdminMenuEditor shops={shops} loading={shopsLoading} />
        )}
      </main>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">
                  Reset & Archive Session?
                </h3>
                <p className="text-xs text-gray-500">
                  Manage delivery cycles and start clean for next orders
                </p>
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-2">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>⚠️ What happens when you reset:</span>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-amber-800">
                <li>
                  Current <strong className="text-black">{orders.length} orders</strong> ({formatPrice(activeGrandTotal)}) will be <strong>archived into Order History</strong>.
                </li>
                <li>
                  Active order board for today will be cleared so members can place new orders for the next meal/session.
                </li>
              </ul>
            </div>

            {/* Session Name input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                Session Name / Label (for history tracking):
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g. Lunch Round 1, Tea Session, etc."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={resetting}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm shadow-amber-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                {resetting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Archive & Reset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

