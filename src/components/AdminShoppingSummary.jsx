import { useState } from "react";
import { formatPrice } from "../utils/price";
import { getToday } from "../utils/today";

/**
 * Admin tab: Shopping Summary
 * Derived from all orders. Grouped by Shop → Food Item → Total Qty (Count detection).
 * Same food items from same shops are aggregated into single counted lines.
 * Shows all active shops (even if 0 orders), shop subtotals, and Grand Total.
 * Includes quick "Copy Text Summary" feature for WhatsApp / messages.
 */
export default function AdminShoppingSummary({ orders = [], shops = [], loading = false }) {
  const [copied, setCopied] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const today = getToday();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 1. Build map of all registered active shops first so shops with 0 orders are displayed
  const shopMap = {};
  for (const shop of shops) {
    shopMap[shop.id] = {
      shopId: shop.id,
      shopName: shop.name,
      items: {},
      totalQty: 0,
      totalAmount: 0,
    };
  }

  // 2. Aggregate orders: count-detection (Shop → Item → count)
  let overallTotal = 0;
  let overallItemCount = 0;

  for (const order of orders) {
    for (const item of order.items || []) {
      if (!shopMap[item.shopId]) {
        shopMap[item.shopId] = {
          shopId: item.shopId,
          shopName: item.shopName || "Unknown Shop",
          items: {},
          totalQty: 0,
          totalAmount: 0,
        };
      }
      const s = shopMap[item.shopId];
      if (!s.items[item.itemId]) {
        s.items[item.itemId] = {
          itemId: item.itemId,
          itemName: item.itemName,
          price: item.price,
          totalQty: 0,
          subtotal: 0,
        };
      }
      s.items[item.itemId].totalQty += item.qty;
      s.items[item.itemId].subtotal += item.price * item.qty;
      s.totalQty += item.qty;
      s.totalAmount += item.price * item.qty;

      overallTotal += item.price * item.qty;
      overallItemCount += item.qty;
    }
  }

  const shopList = Object.values(shopMap);

  // Generate plain text summary formatted cleanly for WhatsApp / Notes
  const generateSummaryText = () => {
    let lines = [];
    lines.push("📋 TODAY'S SHOPPING SUMMARY");
    lines.push(`📅 Date: ${today}`);
    lines.push("");

    if (orders.length === 0) {
      lines.push("No orders placed today.");
      return lines.join("\n");
    }

    for (const shop of shopList) {
      const items = Object.values(shop.items);
      lines.push(`🏪 ${shop.shopName}`);
      if (items.length === 0) {
        lines.push("   (no orders today)");
      } else {
        for (const item of items) {
          lines.push(`   • ${item.itemName.padEnd(24, " ")} x ${item.totalQty}  (${formatPrice(item.subtotal)})`);
        }
        lines.push(`   Shop Total: ${formatPrice(shop.totalAmount)}`);
      }
      lines.push("");
    }

    lines.push("──────────────────────────");
    lines.push(`GRAND TOTAL: ${formatPrice(overallTotal)}`);
    lines.push(`Total Items Ordered: ${overallItemCount}`);

    return lines.join("\n");
  };

  const handleCopyText = async () => {
    try {
      const text = generateSummaryText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy summary:", err);
    }
  };

  if (orders.length === 0 && shopList.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200 p-8">
        <p className="text-4xl mb-3">🛒</p>
        <p className="font-semibold text-gray-700">No orders yet — shopping list is empty.</p>
        <p className="text-xs text-gray-400 mt-1">Orders placed by members will appear here grouped by shop & item count.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header Card with Grand Total & Quick Actions */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-3xl p-5 text-white shadow-lg shadow-brand-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <h2 className="text-lg font-bold">Shopping Summary</h2>
              <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-medium">
                Count-Detected
              </span>
            </div>
            <p className="text-xs text-brand-100 mt-1">
              {orders.length} member orders merged into exact item totals per shop
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowRawText(!showRawText)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/15 hover:bg-white/25 transition-all text-white border border-white/20 flex items-center gap-1.5"
            >
              <span>{showRawText ? "👁️ Hide Text" : "📄 View Text"}</span>
            </button>
            <button
              onClick={handleCopyText}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                copied
                  ? "bg-green-500 text-white"
                  : "bg-white text-brand-700 hover:bg-brand-50"
              }`}
            >
              <span>{copied ? "✅ Copied!" : "📋 Copy Summary"}</span>
            </button>
          </div>
        </div>

        {/* Grand Total Bar */}
        <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-brand-200 font-semibold">
              Grand Total ({overallItemCount} items)
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums">
              {formatPrice(overallTotal)}
            </p>
          </div>
          <div className="text-right text-xs text-brand-200">
            <span>Active Orders: <strong className="text-white">{orders.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Raw Formatted Text Area (Collapsible) */}
      {showRawText && (
        <div className="bg-gray-50 border border-gray-200 text-gray-800 p-4 rounded-2xl font-mono text-xs shadow-inner relative overflow-x-auto">
          <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-200 text-gray-500 font-sans">
            <span className="font-bold">Text Format (Ready for WhatsApp / SMS)</span>
            <button
              onClick={handleCopyText}
              className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 px-2.5 py-1 rounded-lg font-bold transition-colors"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="whitespace-pre font-mono leading-relaxed">{generateSummaryText()}</pre>
        </div>
      )}

      {/* Per Shop Aggregation Cards */}
      <div className="space-y-4">
        {shopList.map((shop) => {
          const items = Object.values(shop.items);
          const hasOrders = items.length > 0;

          return (
            <div
              key={shop.shopId}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                hasOrders
                  ? "bg-white border-gray-200 shadow-sm"
                  : "bg-gray-50/70 border-dashed border-gray-200 opacity-60"
              }`}
            >
              {/* Shop Header */}
              <div className={`px-4 py-3 flex items-center justify-between ${
                hasOrders ? "bg-gray-50/80 border-b border-gray-100" : "bg-transparent"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏪</span>
                  <h3 className="font-bold text-gray-800 text-base">{shop.shopName}</h3>
                  {hasOrders && (
                    <span className="text-xs bg-brand-100 text-brand-700 font-semibold px-2 py-0.5 rounded-full">
                      {shop.totalQty} items
                    </span>
                  )}
                </div>
                <div>
                  {hasOrders ? (
                    <span className="font-bold text-gray-900 tabular-nums text-sm sm:text-base">
                      {formatPrice(shop.totalAmount)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No orders</span>
                  )}
                </div>
              </div>

              {/* Items List */}
              {hasOrders ? (
                <div className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <div
                      key={item.itemId}
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-brand-50 text-brand-700 font-extrabold text-sm border border-brand-100 shadow-xs">
                          ×{item.totalQty}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">
                            {item.itemName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatPrice(item.price)} each
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gray-900 text-sm tabular-nums">
                          {formatPrice(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {/* Shop Subtotal Footer */}
                  <div className="px-4 py-2.5 bg-gray-50/50 flex justify-between items-center text-xs font-semibold text-gray-500 border-t border-gray-100">
                    <span>Shop Subtotal ({shop.totalQty} items)</span>
                    <span className="text-gray-900 font-bold text-sm tabular-nums">
                      {formatPrice(shop.totalAmount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 text-xs text-gray-400 italic">
                  (no orders today for this shop)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



