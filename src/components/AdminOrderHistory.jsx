import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { formatPrice } from "../utils/price";
import { getToday } from "../utils/today";

export default function AdminOrderHistory() {
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const todayStr = getToday();

  useEffect(() => {
    setLoading(true);
    const historyRef = collection(db, "order_history");
    const q = query(historyRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setHistoryList(records);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching order history:", err);
        setError("Could not load history: " + err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  // Filter history by selected date and search term
  const filteredHistory = historyList.filter((session) => {
    // Date filter
    if (selectedDate && session.date !== selectedDate) {
      return false;
    }

    // Search query filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchDate = session.date?.toLowerCase().includes(q);
      const matchSessionName = session.sessionName?.toLowerCase().includes(q);
      
      // Match member names
      const matchMember = session.orders?.some((ord) =>
        ord.userName?.toLowerCase().includes(q)
      );

      // Match item or shop names
      const matchItem = session.orders?.some((ord) =>
        ord.items?.some(
          (item) =>
            item.itemName?.toLowerCase().includes(q) ||
            item.shopName?.toLowerCase().includes(q)
        )
      );

      return matchDate || matchSessionName || matchMember || matchItem;
    }

    return true;
  });

  // Helper to format session date/time
  const formatDateTime = (timestamp, dateStr) => {
    if (!timestamp) return dateStr || "Unknown Date";
    try {
      const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Helper to generate text summary of a historical session for copying
  const copySessionText = async (session) => {
    try {
      let lines = [];
      lines.push(`📋 ORDER HISTORY SUMMARY`);
      lines.push(`📅 Date: ${session.date || "N/A"}`);
      lines.push(`🏷️ Session: ${session.sessionName || "Order Session"}`);
      lines.push("");

      // Group by shop
      const shopMap = {};
      for (const order of session.orders || []) {
        for (const item of order.items || []) {
          const sKey = item.shopId || item.shopName;
          if (!shopMap[sKey]) {
            shopMap[sKey] = {
              shopName: item.shopName,
              items: {},
              totalAmount: 0,
            };
          }
          const s = shopMap[sKey];
          const iKey = item.itemId || item.itemName;
          if (!s.items[iKey]) {
            s.items[iKey] = {
              itemName: item.itemName,
              price: item.price,
              qty: 0,
              subtotal: 0,
            };
          }
          s.items[iKey].qty += item.qty;
          s.items[iKey].subtotal += item.price * item.qty;
          s.totalAmount += item.price * item.qty;
        }
      }

      for (const shop of Object.values(shopMap)) {
        lines.push(`🏪 ${shop.shopName}`);
        for (const item of Object.values(shop.items)) {
          lines.push(`   • ${item.itemName.padEnd(24, " ")} x ${item.qty}  (${formatPrice(item.subtotal)})`);
        }
        lines.push(`   Shop Total: ${formatPrice(shop.totalAmount)}`);
        lines.push("");
      }

      lines.push("──────────────────────────");
      lines.push(`GRAND TOTAL: ${formatPrice(session.totalAmount || 0)}`);
      lines.push(`Total Orders Placed: ${session.orders?.length || 0}`);

      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedId(session.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error("Failed to copy history session text:", err);
    }
  };

  // Helper to delete a history record
  const handleDelete = async (sessionId) => {
    if (!window.confirm("Are you sure you want to permanently delete this archived session?")) {
      return;
    }
    setDeletingId(sessionId);
    try {
      await deleteDoc(doc(db, "order_history", sessionId));
    } catch (err) {
      console.error("Error deleting session:", err);
      alert("Failed to delete: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>📜</span> Order History & Sessions
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Browse archived delivery cycles, view merged item counts, and inspect member breakdowns.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-brand-50 text-brand-700 rounded-full self-start sm:self-auto border border-brand-100">
            {historyList.length} Sessions Archived
          </span>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search member, shop, food..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all pl-8"
            />
            <span className="absolute left-2.5 top-2.5 text-xs text-gray-400">🔍</span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">📅 Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                className="text-xs text-red-500 hover:underline whitespace-nowrap px-1"
                title="Clear date filter"
              >
                Reset
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 sm:col-span-2 lg:col-span-1">
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDate === todayStr
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedDate("")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDate === ""
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All Dates
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-4">
          {error}
        </div>
      )}

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
          <p className="text-4xl mb-3">📜</p>
          <h3 className="font-bold text-gray-800 text-base">No history records found</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            {historyList.length === 0
              ? "When an admin resets/completes an active order cycle, the session snapshot will automatically be archived here."
              : "No archived sessions match your date or search filters."}
          </p>
          {(selectedDate || searchTerm) && (
            <button
              onClick={() => {
                setSelectedDate("");
                setSearchTerm("");
              }}
              className="mt-4 text-xs font-semibold bg-gray-100 text-gray-700 px-3.5 py-1.5 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const orderCount = session.orders?.length || 0;
            const itemCount = (session.orders || []).reduce(
              (sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.qty || 0), 0),
              0
            );

            // Compute shop aggregation for this historical session
            const shopMap = {};
            for (const order of session.orders || []) {
              for (const item of order.items || []) {
                const sKey = item.shopId || item.shopName || "shop";
                if (!shopMap[sKey]) {
                  shopMap[sKey] = {
                    shopName: item.shopName || "Unknown Shop",
                    items: {},
                    totalAmount: 0,
                    totalQty: 0,
                  };
                }
                const shopObj = shopMap[sKey];
                const iKey = item.itemId || item.itemName;
                if (!shopObj.items[iKey]) {
                  shopObj.items[iKey] = {
                    itemName: item.itemName,
                    price: item.price,
                    totalQty: 0,
                    subtotal: 0,
                  };
                }
                shopObj.items[iKey].totalQty += item.qty;
                shopObj.items[iKey].subtotal += item.price * item.qty;
                shopObj.totalQty += item.qty;
                shopObj.totalAmount += item.price * item.qty;
              }
            }

            const shopGroups = Object.values(shopMap);

            return (
              <div
                key={session.id}
                className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200"
              >
                {/* Session Card Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/60 border-b border-gray-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-base">
                        {session.sessionName || "Order Session"}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
                        {session.date}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDateTime(session.createdAt, session.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                      <span>👥 {orderCount} Orders</span>
                      <span>•</span>
                      <span>🍱 {itemCount} Items</span>
                      <span>•</span>
                      <span>🏪 {shopGroups.length} Shops</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
                        Total
                      </span>
                      <span className="text-lg sm:text-xl font-extrabold text-brand-600 tabular-nums">
                        {formatPrice(session.totalAmount || 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => copySessionText(session)}
                        className={`p-2 rounded-xl text-xs font-semibold border transition-all ${
                          copiedId === session.id
                            ? "bg-green-500 text-white border-green-500"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                        title="Copy Summary Text"
                      >
                        {copiedId === session.id ? "✅" : "📋"}
                      </button>

                      <button
                        onClick={() => handleDelete(session.id)}
                        disabled={deletingId === session.id}
                        className="p-2 rounded-xl text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition-colors"
                        title="Delete record"
                      >
                        🗑️
                      </button>

                      <button
                        onClick={() =>
                          setExpandedSessionId(isExpanded ? null : session.id)
                        }
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 transition-colors flex items-center gap-1"
                      >
                        <span>{isExpanded ? "Collapse" : "Details"}</span>
                        <span>{isExpanded ? "▲" : "▼"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Session Details */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-6 bg-white">
                    {/* 1. Aggregated Shopping Summary (Shop -> Food Item Count) */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                          <span>🛒</span> Merged Shopping List ({itemCount} items)
                        </h4>
                        <span className="text-xs text-gray-400">
                          Count-detection aggregated
                        </span>
                      </div>

                      <div className="space-y-3">
                        {shopGroups.map((shop) => (
                          <div
                            key={shop.shopName}
                            className="bg-gray-50/80 rounded-2xl border border-gray-200 overflow-hidden"
                          >
                            <div className="px-4 py-2 bg-gray-100/70 border-b border-gray-200 flex justify-between items-center text-xs font-bold text-gray-800">
                              <span>🏪 {shop.shopName}</span>
                              <span className="tabular-nums">
                                {formatPrice(shop.totalAmount)}
                              </span>
                            </div>
                            <div className="divide-y divide-gray-100 p-2 space-y-1">
                              {Object.values(shop.items).map((item, idx) => (
                                <div
                                  key={idx}
                                  className="px-2 py-1.5 flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-brand-100 text-brand-700 font-extrabold rounded-lg">
                                      ×{item.totalQty}
                                    </span>
                                    <span className="font-medium text-gray-800">
                                      {item.itemName}
                                    </span>
                                    <span className="text-gray-400">
                                      ({formatPrice(item.price)} ea)
                                    </span>
                                  </div>
                                  <span className="font-bold text-gray-900 tabular-nums">
                                    {formatPrice(item.subtotal)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 2. Individual Member Breakdown */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3 flex items-center gap-1.5">
                        <span>👥</span> Member Order Breakdown ({orderCount} Members)
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(session.orders || []).map((ord, idx) => (
                          <div
                            key={idx}
                            className="bg-white rounded-2xl border border-gray-200 p-3 shadow-xs space-y-2"
                          >
                            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                              <span className="font-bold text-gray-900 text-xs">
                                {ord.userName || "Unnamed Member"}
                              </span>
                              <span className="font-bold text-brand-600 text-xs tabular-nums">
                                {formatPrice(ord.total || 0)}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {(ord.items || []).map((it, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between text-xs text-gray-600"
                                >
                                  <span>
                                    {it.itemName} <span className="font-bold text-gray-400">×{it.qty}</span>
                                  </span>
                                  <span className="tabular-nums font-medium">
                                    {formatPrice(it.price * it.qty)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
