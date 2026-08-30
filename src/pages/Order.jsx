import { useEffect, useState, useMemo, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
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

// In-memory module cache for sub-10ms instantaneous loads
let shopsCache = null;

export default function Order() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const today = getToday();

  // ── Active session ──────────────────────────────────────────────────────────
  const { activeSession, sessions, loading: sessionLoading } = useActiveSession();

  // ── Shops + menu items ──────────────────────────────────────────────────────
  const [shops, setShops] = useState(shopsCache || []);
  const [shopsLoading, setShopsLoading] = useState(!shopsCache);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShopFilter, setSelectedShopFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;
    const shopsQ = query(collection(db, "shops"), where("active", "==", true));

    const unsub = onSnapshot(
      shopsQ,
      async (shopsSnap) => {
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
          shopsCache = loaded;

          if (isMounted) {
            setShops(loaded);
            setShopsLoading(false);
          }
        } catch (err) {
          console.error("Error loading shops:", err);
          if (isMounted) setShopsLoading(false);
        }
      },
      (err) => {
        console.error("Shops listener error:", err);
        if (isMounted) setShopsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // ── Quantities + saved order (re-subscribes when session changes) ────────────
  const [quantities, setQuantities]   = useState({});
  const [savedOrder, setSavedOrder]   = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  // Reset quantities when session changes
  useEffect(() => {
    setQuantities({});
    setSavedOrder(null);
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
      } else {
        setSavedOrder(null);
        setQuantities({});
      }
    });
    return unsub;
  }, [user, activeSession?.id]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleQtyChange = useCallback((shopId, itemId, newQty, itemName = "") => {
    setQuantities((prev) => {
      const key = `${shopId}__${itemId}`;
      const updated = { ...prev };
      if (newQty <= 0) {
        delete updated[key];
      } else {
        updated[key] = newQty;
      }
      return updated;
    });

    if (itemName && newQty > 0) {
      showToast({
        message: `${newQty}× ${itemName}`,
        type: "info",
        icon: "🍛",
        duration: 1200,
      });
    }
  }, [showToast]);

  const handleClearAll = useCallback(async () => {
    if (Object.keys(quantities).length === 0 && !savedOrder) return;
    if (window.confirm("Are you sure you want to clear your current order selections?")) {
      setQuantities({});
      if (savedOrder && activeSession?.id && user?.uid) {
        try {
          const orderRef = doc(db, "orders", activeSession.id, "userOrders", user.uid);
          await deleteDoc(orderRef);
          showToast({ message: "Order removed from system", type: "info", icon: "🗑️" });
        } catch (e) {
          console.error("Error deleting order:", e);
        }
      } else {
        showToast({ message: "Selections cleared", type: "info", icon: "🧹" });
      }
    }
  }, [quantities, savedOrder, activeSession?.id, user?.uid, showToast]);

  // ── Selected Items Array Calculation ─────────────────────────────────────────
  const selectedItems = useMemo(() => {
    const list = [];
    for (const shop of shops) {
      for (const item of shop.items || []) {
        const qty = quantities[`${shop.id}__${item.id}`] ?? 0;
        if (qty > 0) {
          list.push({
            shopId: shop.id,
            shopName: shop.name || "Shop",
            itemId: item.id,
            itemName: item.name || "Item",
            price: Number(item.price) || 0,
            qty: Number(qty) || 1,
          });
        }
      }
    }
    return list;
  }, [shops, quantities]);

  const grandTotal = useMemo(() => {
    return selectedItems.reduce((sum, it) => sum + it.price * it.qty, 0);
  }, [selectedItems]);

  // ── Diff Tracker: check if current selections differ from saved order in DB ──
  const isModified = useMemo(() => {
    if (!savedOrder) {
      return selectedItems.length > 0;
    }
    const savedMap = {};
    for (const it of savedOrder.items ?? []) {
      savedMap[`${it.shopId}__${it.itemId}`] = it.qty;
    }
    const currentKeys = Object.keys(quantities);
    const savedKeys = Object.keys(savedMap);

    if (currentKeys.length !== savedKeys.length) return true;
    for (const k of currentKeys) {
      if (quantities[k] !== savedMap[k]) return true;
    }
    return false;
  }, [quantities, savedOrder, selectedItems.length]);

  // ── Strict DB Field Validation & Save ────────────────────────────────────────
  async function handleSave() {
    if (!user || !activeSession?.id) return;
    const userName = profile?.name || user.displayName || user.email || "Member";

    setSaving(true);
    setError("");

    try {
      // If user emptied their order completely
      if (selectedItems.length === 0) {
        if (savedOrder) {
          const orderRef = doc(db, "orders", activeSession.id, "userOrders", user.uid);
          await deleteDoc(orderRef);
          showToast({ message: "Order cleared successfully", type: "info", icon: "✓" });
        }
        setSaving(false);
        return;
      }

      // 1. Strict validation of every item field
      const validatedItems = selectedItems.map((item) => {
        if (!item.shopId || !item.itemId || !item.itemName) {
          throw new Error("Invalid item structure detected. Please refresh and try again.");
        }
        const price = Number(item.price);
        const qty = parseInt(item.qty, 10);

        if (isNaN(price) || price < 0) {
          throw new Error(`Invalid price for item: ${item.itemName}`);
        }
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Invalid quantity for item: ${item.itemName}`);
        }

        return {
          shopId: String(item.shopId).trim(),
          shopName: String(item.shopName || "Shop").trim(),
          itemId: String(item.itemId).trim(),
          itemName: String(item.itemName).trim(),
          price,
          qty,
        };
      });

      const total = validatedItems.reduce((s, i) => s + i.price * i.qty, 0);

      // 2. Strict validation of order payload
      const orderPayload = {
        userName: String(userName).trim(),
        sessionId: String(activeSession.id),
        sessionType: String(activeSession.type || "custom"),
        sessionLabel: String(activeSession.label || "Session"),
        items: validatedItems,
        total,
        updatedAt: serverTimestamp(),
        createdAt: savedOrder?.createdAt ?? serverTimestamp(),
      };

      const orderRef = doc(db, "orders", activeSession.id, "userOrders", user.uid);
      await setDoc(orderRef, orderPayload);

      showToast({
        message: savedOrder ? "✨ Order updated in real-time!" : `🍛 ${activeSession.label} order placed!`,
        type: "success",
        icon: "🎉",
        duration: 3500,
      });
    } catch (err) {
      console.error("Order save error:", err);
      setError("Failed to save: " + err.message);
      showToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  function getQty(shopId, itemId) {
    return quantities[`${shopId}__${itemId}`] ?? 0;
  }

  // ── Filtered shops by search query and shop tab filter ───────────────────────
  const filteredShops = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();
    return shops
      .filter((shop) => selectedShopFilter === "all" || shop.id === selectedShopFilter)
      .map((shop) => {
        if (!queryLower) return shop;
        const matchingItems = (shop.items || []).filter(
          (item) =>
            item.name?.toLowerCase().includes(queryLower) ||
            shop.name?.toLowerCase().includes(queryLower)
        );
        return {
          ...shop,
          items: matchingItems,
        };
      })
      .filter((shop) => shop.items.length > 0 || !queryLower);
  }, [shops, searchQuery, selectedShopFilter]);

  // ── Derived: today's closed sessions ────────────────────────────────────────
  const closedToday = sessions.filter((s) => s.status === "closed");

  // ── Render: Waiting screen (no active session) ───────────────────────────────
  if (!sessionLoading && !activeSession) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 pt-16 pb-16 text-center">
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
                The manager will open a session soon — this page updates <strong>automatically in real-time</strong> the moment orders open.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Watching live for next session…
            </div>

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

          <p className="text-xs text-gray-400 mt-4 font-medium">
            {today} · Mahaweli Foods Live Sync
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

      <main className="max-w-5xl mx-auto px-4 pt-5 pb-36">

        {/* Live Session Banner */}
        <div className={`mb-5 rounded-3xl border ${sessionCfg.border} ${sessionCfg.bg} px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{sessionCfg.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`font-black text-base sm:text-lg ${sessionCfg.text}`}>
                  {sessionCfg.label} Orders
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2.5 py-0.5 rounded-full animate-pulse shadow-xs">
                  LIVE OPEN
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 font-medium">
                {today} · Select your meals & drinks
                {savedOrder && ` · Order saved in system ✓`}
              </p>
            </div>
          </div>

          {savedOrder && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className={`text-xs font-black ${sessionCfg.text} bg-white px-3 py-1.5 rounded-2xl border ${sessionCfg.border} shadow-2xs`}>
                Saved: {formatPrice(savedOrder.total)}
              </span>
            </div>
          )}
        </div>

        {/* Live Status indicator when order modified */}
        {savedOrder && isModified && (
          <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚡</span>
              <div>
                <p className="font-extrabold text-xs sm:text-sm">You have modified your order!</p>
                <p className="text-[11px] text-amber-700 font-medium">Tap "Update Order" on the bottom bar to save your new selections to the system.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-95 whitespace-nowrap"
            >
              {saving ? "Saving..." : "Update Now"}
            </button>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl px-4 py-3 font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* ── Search & Shop Filters Bar ──────────────────────────────────────── */}
        {!shopsLoading && shops.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Live Search Input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="🔍 Fast search food or shop (e.g. Kottu, Rice, Tea)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm font-semibold text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-xs transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Shop Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedShopFilter("all")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                    selectedShopFilter === "all"
                      ? "bg-brand-600 text-white shadow-xs"
                      : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  All Shops ({shops.length})
                </button>
                {shops.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedShopFilter(s.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      selectedShopFilter === s.id
                        ? "bg-brand-600 text-white shadow-xs"
                        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Shops Grid ──────────────────────────────────────────────────────── */}
        {shopsLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-3xl p-8 max-w-md mx-auto shadow-sm">
            <p className="text-5xl mb-4">🏪</p>
            <h2 className="font-extrabold text-gray-800 text-lg mb-2">No shops or menu items found</h2>
            <p className="text-xs sm:text-sm text-gray-500">The manager needs to add shops and menu items in the Admin panel.</p>
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-3xl p-8 max-w-md mx-auto shadow-xs">
            <p className="text-4xl mb-3">🔍</p>
            <h3 className="font-bold text-gray-800 text-base">No food matches "{searchQuery}"</h3>
            <p className="text-xs text-gray-400 mt-1">Try searching another food name or clear the search.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedShopFilter("all");
              }}
              className="mt-4 px-4 py-2 bg-brand-50 text-brand-700 font-bold text-xs rounded-xl hover:bg-brand-100 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredShops.map((shop, idx) => (
              <ShopOrderCard
                key={shop.id}
                shop={shop}
                items={shop.items}
                quantities={Object.fromEntries(
                  (shop.items || []).map((item) => [item.id, getQty(shop.id, item.id)])
                )}
                onQtyChange={(itemId, newQty, itemName) => handleQtyChange(shop.id, itemId, newQty, itemName)}
                accentIdx={idx}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Sticky interactive bottom bar & live order drawer ────────────────── */}
      {!shopsLoading && (
        <OrderSummaryBar
          selectedItems={selectedItems}
          total={grandTotal}
          onSave={handleSave}
          onQtyChange={handleQtyChange}
          onClearAll={handleClearAll}
          saving={saving}
          isModified={isModified}
          isSaved={!!savedOrder}
          savedTotal={savedOrder?.total ?? null}
        />
      )}
    </div>
  );
}
