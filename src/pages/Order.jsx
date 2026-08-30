import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { getToday } from "../utils/today";
import { formatPrice } from "../utils/price";
import { useActiveSession } from "../hooks/useActiveSession";
import Navbar from "../components/Navbar";
import ShopOrderCard from "../components/ShopOrderCard";
import OrderSummaryBar from "../components/OrderSummaryBar";

const SESSION_CONFIG = {
  morning: { label: "Morning",  icon: "☀️",  gradient: "from-amber-400 to-orange-400",  bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800"  },
  lunch:   { label: "Lunch",    icon: "🍽️", gradient: "from-green-400 to-emerald-400", bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800"  },
  dinner:  { label: "Dinner",   icon: "🌙",  gradient: "from-indigo-400 to-purple-400", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800" },
  extra:   { label: "Extra",    icon: "⭐",  gradient: "from-rose-400 to-pink-400",     bg: "bg-rose-50",   border: "border-rose-200",   text: "text-rose-800"   },
};

export default function Order() {
  const { user, profile } = useAuth();
  const today = getToday();

  // ── Active session ──────────────────────────────────────────────────────────
  const { activeSession, sessions, loading: sessionLoading } = useActiveSession();

  // ── Shops + menu items ──────────────────────────────────────────────────────
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(true);

  useEffect(() => {
    setShopsLoading(true);
    const shopsQ = query(collection(db, "shops"), where("active", "==", true));
    const unsub = onSnapshot(shopsQ, async (shopsSnap) => {
      try {
        const shopDocs = shopsSnap.docs.map((d) => ({ id: d.id, ...d.data(), items: [] }));
        const loaded = await Promise.all(
          shopDocs.map(async (shop) => {
            const itemsSnap = await getDocs(
              query(collection(db, "shops", shop.id, "items"), where("active", "==", true))
            );
            shop.items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            return shop;
          })
        );
        loaded.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setShops(loaded);
      } catch (err) {
        console.error("Error loading shops:", err);
      } finally {
        setShopsLoading(false);
      }
    });
    return unsub;
  }, []);

  // ── Quantities + saved order (re-subscribes when session changes) ────────────
  const [quantities, setQuantities]   = useState({});
  const [savedOrder, setSavedOrder]   = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  // Reset quantities when session changes
  useEffect(() => {
    setQuantities({});
    setSavedOrder(null);
    setSaveSuccess(false);
    setError("");
  }, [activeSession?.id]);

  // Live-listen to the user's order in the active session
  useEffect(() => {
    if (!user || !activeSession?.id) return;

    const orderRef = doc(db, "orders", activeSession.id, "userOrders", user.uid);
    const unsub = onSnapshot(orderRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSavedOrder(data);
        const newQtys = {};
        for (const item of data.items ?? []) {
          newQtys[`${item.shopId}__${item.itemId}`] = item.qty;
        }
        setQuantities(newQtys);
        setSaveSuccess(true);
      } else {
        setSavedOrder(null);
        setSaveSuccess(false);
        setQuantities({});
      }
    });
    return unsub;
  }, [user, activeSession?.id]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleQtyChange(shopId, itemId, newQty) {
    setQuantities((prev) => {
      const key = `${shopId}__${itemId}`;
      const updated = { ...prev };
      if (newQty === 0) delete updated[key];
      else updated[key] = newQty;
      return updated;
    });
    setSaveSuccess(false);
  }

  const grandTotal = shops.reduce((total, shop) =>
    total + shop.items.reduce((s, item) => s + item.price * (quantities[`${shop.id}__${item.id}`] ?? 0), 0)
  , 0);

  async function handleSave() {
    if (!user || !profile || !activeSession?.id) return;
    setSaving(true);
    setError("");
    try {
      const items = [];
      for (const shop of shops) {
        for (const item of shop.items) {
          const qty = quantities[`${shop.id}__${item.id}`] ?? 0;
          if (qty > 0) {
            items.push({
              shopId: shop.id,
              shopName: shop.name,
              itemId: item.id,
              itemName: item.name,
              price: item.price,
              qty,
            });
          }
        }
      }
      const total = items.reduce((s, i) => s + i.price * i.qty, 0);
      const orderRef = doc(db, "orders", activeSession.id, "userOrders", user.uid);
      await setDoc(orderRef, {
        userName: profile.name,
        sessionId: activeSession.id,
        sessionType: activeSession.type,
        sessionLabel: activeSession.label,
        items,
        total,
        updatedAt: serverTimestamp(),
        createdAt: savedOrder?.createdAt ?? serverTimestamp(),
      });
      setSaveSuccess(true);
    } catch (err) {
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function getQty(shopId, itemId) {
    return quantities[`${shopId}__${itemId}`] ?? 0;
  }

  // ── Derived: today's closed sessions (so user can see what happened) ─────────
  const closedToday = sessions.filter((s) => s.status === "closed");

  // ── Render: Waiting screen (no active session) ───────────────────────────────
  if (!sessionLoading && !activeSession) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 pt-16 pb-16 text-center">
          {/* Waiting animation */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-10 space-y-5">
            <div className="relative w-20 h-20 mx-auto">
              <div className="w-20 h-20 rounded-full bg-brand-50 border-2 border-brand-200 flex items-center justify-center text-3xl">
                🍴
              </div>
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gray-300 rounded-full border-2 border-white animate-pulse" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Orders Not Open Yet</h2>
              <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                The admin will open a session soon — this page updates <strong>automatically</strong> the moment orders open.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
              <span className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
              Watching for new session…
            </div>

            {/* Show today's closed sessions */}
            {closedToday.length > 0 && (
              <div className="pt-4 border-t border-gray-100 space-y-2 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 text-center">Today's Completed Sessions</p>
                {closedToday.map((s) => {
                  const cfg = SESSION_CONFIG[s.type];
                  return (
                    <div key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${cfg?.bg} ${cfg?.border} border text-xs ${cfg?.text} font-semibold`}>
                      <span>{cfg?.icon}</span>
                      <span>{cfg?.label} Session</span>
                      <span className="ml-auto text-[10px] font-bold uppercase bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Closed</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-4">
            {today} · You'll be notified automatically
          </p>
        </main>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Active session ordering view ─────────────────────────────────────────────
  const sessionCfg = SESSION_CONFIG[activeSession.type] ?? SESSION_CONFIG.extra;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-32">

        {/* Session Banner */}
        <div className={`mb-6 rounded-3xl border ${sessionCfg.border} ${sessionCfg.bg} px-5 py-4 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{sessionCfg.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`font-extrabold text-base ${sessionCfg.text}`}>
                  {sessionCfg.label} Orders
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  OPEN
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {today} · Choose what you'd like
                {savedOrder && ` · Order saved ✓`}
              </p>
            </div>
          </div>
          {savedOrder && (
            <span className={`text-xs font-bold ${sessionCfg.text} bg-white px-3 py-1.5 rounded-full border ${sessionCfg.border}`}>
              {formatPrice(savedOrder.total)} saved
            </span>
          )}
        </div>

        {/* Save success */}
        {saveSuccess && savedOrder && (
          <div className="mb-5 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-green-800 font-semibold text-sm">
                Your {sessionCfg.label} order is saved!
              </p>
              <p className="text-green-600 text-xs mt-0.5">
                Total: {formatPrice(savedOrder.total)} — You can update it any time before the session closes.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Shops grid */}
        {shopsLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-3xl p-8 max-w-md mx-auto">
            <p className="text-5xl mb-4">🏪</p>
            <h2 className="font-bold text-gray-800 text-lg mb-2">No shops or menu items found</h2>
            <p className="text-sm text-gray-500">The admin needs to set up shops and menu items first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {shops.map((shop, idx) => (
              <ShopOrderCard
                key={shop.id}
                shop={shop}
                items={shop.items}
                quantities={Object.fromEntries(
                  shop.items.map((item) => [item.id, getQty(shop.id, item.id)])
                )}
                onQtyChange={(itemId, newQty) => handleQtyChange(shop.id, itemId, newQty)}
                accentIdx={idx}
              />
            ))}
          </div>
        )}
      </main>

      {/* Sticky save bar */}
      {!shopsLoading && (
        <OrderSummaryBar
          total={grandTotal}
          onSave={handleSave}
          saving={saving}
          saved={saveSuccess}
          savedTotal={savedOrder?.total ?? null}
        />
      )}
    </div>
  );
}
