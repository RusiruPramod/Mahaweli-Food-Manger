import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { getToday } from "../utils/today";
import { formatPrice } from "../utils/price";
import Navbar from "../components/Navbar";
import ShopOrderCard from "../components/ShopOrderCard";
import OrderSummaryBar from "../components/OrderSummaryBar";

export default function Order() {
  const { user, profile } = useAuth();
  const today = getToday();

  const [shops, setShops] = useState([]);  // [{ id, name, order, active, items: [] }]
  const [shopsLoading, setShopsLoading] = useState(true);
  const [quantities, setQuantities] = useState({}); // { [shopId_itemId]: number }
  const [saving, setSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null); // the already-saved order doc
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  // ----- Load shops + items -----
  useEffect(() => {
    setShopsLoading(true);

    // Real-time listener on shops (filtered by active)
    const shopsQ = query(
      collection(db, "shops"),
      where("active", "==", true)
    );

    const unsub = onSnapshot(
      shopsQ,
      async (shopsSnap) => {
        try {
          const shopDocs = shopsSnap.docs.map((d) => ({ id: d.id, ...d.data(), items: [] }));

          // Fetch items for each shop
          const shopPromises = shopDocs.map(async (shop) => {
            const itemsSnap = await getDocs(
              query(collection(db, "shops", shop.id, "items"), where("active", "==", true))
            );
            shop.items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            return shop;
          });

          const loadedShops = await Promise.all(shopPromises);
          // Sort shops client-side to avoid composite index requirement
          loadedShops.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          
          setShops(loadedShops);
          setShopsLoading(false);
        } catch (err) {
          console.error("Error loading shop items:", err);
          setError("Error loading menu: " + err.message);
          setShopsLoading(false);
        }
      },
      (err) => {
        console.error("Firestore onSnapshot error:", err);
        setError("Database connection error: " + err.message);
        setShopsLoading(false);
      }
    );

    return unsub;
  }, []);

  // ----- Load today's existing order for this user -----
  useEffect(() => {
    if (!user) return;

    const orderRef = doc(db, "orders", today, "userOrders", user.uid);
    const unsub = onSnapshot(orderRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSavedOrder(data);

        // Prefill quantities from saved order
        const newQtys = {};
        for (const item of data.items ?? []) {
          newQtys[`${item.shopId}__${item.itemId}`] = item.qty;
        }
        setQuantities(newQtys);
        setSaveSuccess(true);
      } else {
        setSavedOrder(null);
        setSaveSuccess(false);
      }
    });

    return unsub;
  }, [user, today]);

  // ----- Qty change handler -----
  function handleQtyChange(shopId, itemId, newQty) {
    setQuantities((prev) => {
      const key = `${shopId}__${itemId}`;
      const updated = { ...prev };
      if (newQty === 0) {
        delete updated[key];
      } else {
        updated[key] = newQty;
      }
      return updated;
    });
    setSaveSuccess(false);
  }

  // ----- Compute grand total -----
  const grandTotal = shops.reduce((total, shop) => {
    return (
      total +
      shop.items.reduce((shopSum, item) => {
        const qty = quantities[`${shop.id}__${item.id}`] ?? 0;
        return shopSum + item.price * qty;
      }, 0)
    );
  }, 0);

  // ----- Save order -----
  async function handleSave() {
    if (!user || !profile) return;
    setSaving(true);
    setError("");

    try {
      // Build items array from current quantities
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
              price: item.price, // snapshot at save time
              qty,
            });
          }
        }
      }

      const total = items.reduce((s, i) => s + i.price * i.qty, 0);
      const orderRef = doc(db, "orders", today, "userOrders", user.uid);

      await setDoc(orderRef, {
        userName: profile.name,
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

  // ----- Get qty for a shop item -----
  function getQty(shopId, itemId) {
    return quantities[`${shopId}__${itemId}`] ?? 0;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-32">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">
            Today's Order
          </h1>
          <p className="text-gray-500 text-sm mt-1">{today} · Choose what you'd like 🍽️</p>
        </div>

        {/* Save success banner */}
        {saveSuccess && savedOrder && (
          <div className="mb-5 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-green-800 font-semibold text-sm">
                Your order for today is saved!
              </p>
              <p className="text-green-600 text-xs mt-0.5">
                Total: {formatPrice(savedOrder.total)} — You can update it anytime before food is collected.
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
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-3">🏪</p>
            <p className="font-medium">No shops available right now.</p>
            <p className="text-sm mt-1">Check back soon!</p>
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
                onQtyChange={(itemId, newQty) =>
                  handleQtyChange(shop.id, itemId, newQty)
                }
                accentIdx={idx}
              />
            ))}
          </div>
        )}
      </main>

      {/* Sticky bottom bar */}
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
