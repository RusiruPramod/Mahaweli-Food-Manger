import { getToday } from "../utils/today";
import { formatPrice } from "../utils/price";
import { ClipboardList, Store } from "./Icons";

/**
 * Admin tab: Shopping Summary
 * Pure count-based checklist for purchasing food with each shop's total amount in the corner.
 * Minimalist, elegant list-based layout.
 */
export default function AdminShoppingSummary({ orders = [], shops = [], loading = false }) {
  const today = getToday();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 1. Build map of active shops
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

  // 2. Aggregate orders: count-detection & shop total amount calculation
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
          totalQty: 0,
        };
      }
      const itemPrice = item.price || 0;
      s.items[item.itemId].totalQty += item.qty;
      s.totalQty += item.qty;
      s.totalAmount += itemPrice * item.qty;
      overallItemCount += item.qty;
    }
  }

  const shopList = Object.values(shopMap);
  const activeShopsCount = shopList.filter((shop) => shop.totalQty > 0).length;

  if (orders.length === 0 && shopList.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
        <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="font-bold text-gray-800 text-base">Shopping List is Empty</h3>
        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
          When members place their orders, aggregated item counts per shop will automatically appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unified checklist Manifest Card */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center border border-brand-100">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-gray-900 text-sm sm:text-base tracking-tight">
                TODAY'S SHOPPING SUMMARY
              </h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                Date: {today}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-gray-500">
            <span>Shops: <strong className="text-gray-900">{activeShopsCount} / {shopList.length}</strong></span>
            <span>•</span>
            <span>Total Items: <strong className="text-brand-600">{overallItemCount}</strong></span>
          </div>
        </div>

        {/* Manifest List Content */}
        <div className="p-6 space-y-6">
          {shopList.map((shop) => {
            const items = Object.values(shop.items);
            const hasOrders = items.length > 0;

            return (
              <div key={shop.shopId} className="space-y-2.5">
                {/* Shop Name and Corner Total */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-gray-500" />
                    <h3 className="font-extrabold text-gray-800 text-sm sm:text-base">
                      {shop.shopName}
                    </h3>
                  </div>
                  {hasOrders && (
                    <span className="text-xs sm:text-sm font-bold text-gray-600">
                      Total: <span className="text-brand-600 font-extrabold">{formatPrice(shop.totalAmount)}</span>
                    </span>
                  )}
                </div>

                {/* Items */}
                {hasOrders ? (
                  <div className="pl-6 space-y-1.5 border-l border-gray-150 ml-2">
                    {items.map((item) => (
                      <div
                        key={item.itemId}
                        className="flex items-center justify-between text-xs sm:text-sm py-1 max-w-md"
                      >
                        <span className="text-gray-700 font-medium">
                          • {item.itemName}
                        </span>
                        <span className="font-extrabold text-gray-900 tabular-nums">
                          x {item.totalQty}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pl-6 text-xs text-gray-400 italic ml-2">
                    (no orders today)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Card Footer */}
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500">
          <span>Total Items to Buy</span>
          <span className="text-brand-600 font-black text-sm">
            {overallItemCount} items
          </span>
        </div>
      </div>
    </div>
  );
}





