import { useState } from "react";
import { formatPrice } from "../utils/price";

/**
 * Enhanced Sticky bottom bar & expandable interactive drawer.
 *
 * Props:
 *  - selectedItems: [{ shopId, shopName, itemId, itemName, price, qty }]
 *  - total: number
 *  - onSave: async () => void
 *  - onQtyChange: (shopId, itemId, newQty, itemName) => void
 *  - onClearAll: () => void
 *  - saving: boolean
 *  - isModified: boolean
 *  - isSaved: boolean
 *  - savedTotal: number | null
 */
export default function OrderSummaryBar({
  selectedItems = [],
  total,
  onSave,
  onQtyChange,
  onClearAll,
  saving,
  isModified,
  isSaved,
  savedTotal,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const totalItemCount = selectedItems.reduce((s, it) => s + (it.qty || 0), 0);

  return (
    <>
      {/* ── Slide-up Drawer Backdrop ────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Slide-up Drawer Details ─────────────────────────────────────────── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl border-t border-gray-200 shadow-2xl transition-transform duration-300 ease-out max-h-[85vh] flex flex-col ${
          drawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛍️</span>
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm sm:text-base">
                Your Order Summary ({totalItemCount} {totalItemCount === 1 ? "item" : "items"})
              </h3>
              <p className="text-xs text-gray-500">
                {isModified ? "You have unsaved changes" : isSaved ? "In sync with system" : "Review your selections"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedItems.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 font-bold text-sm cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Drawer Item List */}
        <div className="p-4 overflow-y-auto divide-y divide-gray-100 flex-1 space-y-2">
          {selectedItems.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="text-sm font-semibold">No food items selected yet.</p>
              <p className="text-xs text-gray-400 mt-1">Tap + on any food to add to your order.</p>
            </div>
          ) : (
            selectedItems.map((item) => (
              <div
                key={`${item.shopId}-${item.itemId}`}
                className="pt-2 pb-2 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">
                    {item.shopName}
                  </span>
                  <p className="font-bold text-gray-900 text-sm truncate">{item.itemName}</p>
                  <p className="text-xs text-gray-500">
                    {formatPrice(item.price)} × {item.qty} = <strong className="text-brand-600">{formatPrice(item.price * item.qty)}</strong>
                  </p>
                </div>

                {/* Quick Drawer Stepper */}
                <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => onQtyChange(item.shopId, item.itemId, item.qty - 1, item.itemName)}
                    className="w-7 h-7 rounded-lg bg-white shadow-2xs hover:bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-sm cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-extrabold text-xs text-gray-900 tabular-nums">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQtyChange(item.shopId, item.itemId, item.qty + 1, item.itemName)}
                    className="w-7 h-7 rounded-lg bg-brand-500 hover:bg-brand-600 text-white shadow-2xs flex items-center justify-center font-bold text-sm cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500">Total Order Amount</p>
            <p className="text-xl font-black text-gray-900">{formatPrice(total)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              onSave();
            }}
            disabled={saving || (total === 0 && !isSaved)}
            className={`
              px-6 py-3 rounded-2xl font-black text-sm transition-all duration-200
              flex items-center justify-center gap-2 shadow-md cursor-pointer
              ${saving
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : total === 0 && !isSaved
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : isSaved && !isModified
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
                : "bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/30 active:scale-95"
              }
            `}
          >
            {saving ? "Saving..." : isSaved && !isModified ? "✓ Order Saved (Update)" : "Save Order Now"}
          </button>
        </div>
      </div>

      {/* ── Fixed Sticky Bottom Bar ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.1)]">
        <div className="max-w-5xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          
          {/* Total & Quick Drawer Trigger */}
          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            className="flex-1 min-w-0 text-left group cursor-pointer flex items-center gap-3"
          >
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                🍽️
              </div>
              {totalItemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-50">
                  {totalItemCount}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-lg sm:text-xl font-black text-gray-900 leading-none">
                  {formatPrice(total)}
                </p>
                {isModified && isSaved && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded-md animate-pulse">
                    Modified
                  </span>
                )}
                {isSaved && !isModified && total > 0 && (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                    ✓ Saved
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 font-semibold truncate flex items-center gap-1 mt-0.5 group-hover:text-brand-600 transition-colors">
                <span>{totalItemCount} {totalItemCount === 1 ? "item" : "items"} selected</span>
                <span>· Tap to view breakdown ▲</span>
              </p>
            </div>
          </button>

          {/* Action Save Button */}
          <button
            type="button"
            id="save-order-btn"
            onClick={onSave}
            disabled={saving || (total === 0 && !isSaved)}
            className={`
              px-5 sm:px-7 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all duration-200
              min-w-[130px] sm:min-w-[160px] flex items-center justify-center gap-2 cursor-pointer
              ${saving
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : total === 0 && !isSaved
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : isSaved && isModified
                ? "bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/30 active:scale-95 animate-pulse"
                : isSaved
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 active:scale-95"
                : "bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/30 active:scale-95"
              }
            `}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : isSaved && isModified ? (
              <>
                <span>⚡</span>
                <span>Update Order</span>
              </>
            ) : isSaved ? (
              <>
                <span>✓</span>
                <span>Order Saved</span>
              </>
            ) : (
              <>
                <span>Place Order</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
