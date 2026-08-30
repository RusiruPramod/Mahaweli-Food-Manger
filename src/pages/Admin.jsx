import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { getToday } from "../utils/today";
import Navbar from "../components/Navbar";
import AdminOrderList from "../components/AdminOrderList";
import AdminShoppingSummary from "../components/AdminShoppingSummary";
import AdminMenuEditor from "../components/AdminMenuEditor";

const TABS = [
  { id: "orders", label: "Today's Orders", emoji: "📋" },
  { id: "summary", label: "Shopping Summary", emoji: "🛒" },
  { id: "menu", label: "Manage Menu", emoji: "⚙️" },
];

export default function Admin() {
  const today = getToday();
  const [activeTab, setActiveTab] = useState("orders");

  // ---------- Today's orders (real-time) ----------
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    const ordersRef = collection(db, "orders", today, "userOrders");
    const unsub = onSnapshot(ordersRef, (snap) => {
      const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      setOrders(data);
      setOrdersLoading(false);
    });
    return unsub;
  }, [today]);

  // ---------- All Users (real-time) ----------
  const [allUsers, setAllUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    const usersRef = collection(db, "users");
    const unsub = onSnapshot(usersRef, (snap) => {
      const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      setAllUsers(data);
      setUsersLoading(false);
    });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-12">
        {/* Page heading */}
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-gray-900">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-1">{today}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-200 p-1 rounded-2xl mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 min-w-max flex items-center justify-center gap-1.5
                px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                ${activeTab === tab.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
                }
              `}
            >
              <span>{tab.emoji}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
            </button>
          ))}
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
          <AdminShoppingSummary orders={orders} loading={ordersLoading} />
        )}
        {activeTab === "menu" && (
          <AdminMenuEditor shops={shops} loading={shopsLoading} />
        )}
      </main>
    </div>
  );
}
